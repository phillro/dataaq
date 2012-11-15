var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    mongoose = require('mongoose'),
    connect = require('connect'),
    express = require('express');

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', './etc/conf']
});

cli.main(function (args, options) {

    var conf
    try {
        conf = require(options.config_path)[options.env]
        if (!conf) {
            throw new Exception('Config file not found')
        }
    } catch (ex) {
        cli.fatal('Config file not found. Using: ' + options.config_path)
    }

    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);

    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(ordrinMongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    var app = express.createServer();

    app.configure(function () {
        app.set('views', __dirname + '/views');
        app.set('view engine', 'ejs');
        app.use(express.cookieParser());
        app.use(express.methodOverride());
        app.use(express.bodyParser());
    });

    app.all('*', function (req, res, next) {
        req.models = mongooseLayer.models;
        req.redisClient = redisClient;
        next();
    })

    app.get('/scrape/show/:id', function (req, res) {
        req.models.Scrape.findById(req.params.id, function (err, scrape) {
            if (err) {
                res.send({err:err.toString()});
            } else {
                res.render('scrape',{scrape:scrape});
            }
        })
    })

    app.get('/ven/show/:id', function (req, res) {
        req.models.RestaurantMerged.findById(req.params.id, function (err, rest) {
            if (err) {
                res.send({err:err.toString()});
            } else {
                if (rest) {
                    res.render('show', {venue:rest});
                }
                else {
                    res.send({err:'Not found'});
                }
            }
        })
    })

    app.get('/ven/list', function (req, res) {
        var start = req.query.next || 0;
        var limit = req.query.limit || 20;
        var onlyenabled = req.query.onlyenabled == 'true' ? true : false;
        var excluded = req.query.excluded == 'true' ? true : false;
        start = parseFloat(start);
        limit = parseFloat(limit);
        var query = {};
        if (onlyenabled) {
            query.enabled = onlyenabled;
        }
        if (excluded) {
            query.excluded = excluded;
        }
        req.models.RestaurantMerged.find(query, {}, {skip:start, limit:limit, sort:{feature_count:-1}}, function (err, venues) {
            if (err) {
                res.send({err:err.toStrin()});
            } else {
                if (venues) {
                    var out = [];
                    for (var i = 0; i < venues.length; i++) {
                        out.push(venues[i]._doc);
                    }
                    res.render('list', {venues:venues, prev:start - limit, next:start + limit, limit:limit});
                    //res.send({restaurants:out});
                }
                else {
                    res.send({err:'Not found'});
                }
            }
        })

    })

    app.listen(8080);
});
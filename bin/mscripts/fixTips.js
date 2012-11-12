var async = require('async'),
    nodeio = require('node.io'),
    mongoose = require('mongoose'),
    InputQueue = require('../../lib/InputQueue.js').InputQueue,
    ProxyQueue = require('../../lib/ProxyQueue.js').ProxyQueue,
    JobQueue = require('../../lib/JobQueue.js').JobQueue,
    cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    uuid = require('node-uuid'),
    FsqClient = require('foursquarevenues')

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf'],
    max:['m', 'Max to run concurrently', 'number', 1]
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

    var network = 'foursquare';
    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);
    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(ordrinMongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    mongooseLayer.models.Scrape.find({network:'nymag', 'data.tips':{$exists:true}}, function (err, scrapes) {
        async.forEach(scrapes, function (scrape, callback) {
            var tips = {
                count:0,
                groups:[]
            };

            for (var i = 0; i < scrape.data.tips.groups.length; i++) {
                var group =scrape.data.tips.groups[i];
                var item = group;
                var fixedGroup = {
                    items:[item],
                    count:1,
                    name:'Recommended Dishes'
                }
                scrape.data.tips.groups=[
                    fixedGroup
                ]
            }

            scrape.data.tipCount=null;
            scrape.data.tips = tips;
            scrape.markModified('data');
            scrape.save(callback);

        }, function (forEachError) {
            if (forEachError) {
                console.log(forEachError);
            }
            console.log('done');
            process.exit(0);
        });

    })

})
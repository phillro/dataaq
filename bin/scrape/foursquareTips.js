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

    var foursquare = new FsqClient('TYR00ZTQ44Q5E0NOWHBJSZLXFRKK1MZUCF1NJ0WWPTK1IG01', 'SNT2F4NQC0QKP0DSRXFR1ZUV1PPA0LIUAGBNWO2S3N2XDLC3')

    function updateScrape(scrape, res, updateScrapeCb) {
        if (res && res.response && res.response.tips) {
            var fsqVenue = res.response.venue;
            scrape.data.fsqtips=res.response.tips;



            scrape.markModified('data');
            scrape.save(function(err,saved){
                updateScrapeCb(err,saved);
            })
            //updateScrapeCb();
        } else {
            updateScrapeCb();
        }

    }

    mongooseLayer.models.Scrape.find({network:'foursquare', 'data.fsqid':{$exists:true}}, {}, {sort:{updatedAt:1}}, function (err, scrapes) {
    //mongooseLayer.models.Scrape.find({network:'foursquare', '_id':'50a2dea7e6bab542060000d4'}, {}, {sort:{updatedAt:1}}, function (err, scrapes) {

        async.forEachSeries(scrapes, function (scrape, forEachScrapeCb) {
            async.waterfall([
                function getFsqVenue(getFsqVenueCb) {
                    var fsqid = scrape.data.fsqid;
                    foursquare.getTips({venue_id:fsqid}, function (fsqErr, fsqVenue) {
                        getFsqVenueCb(fsqErr, scrape, fsqVenue);
                    });
                },
                function fsqVenue(scrape, fsqVenue, fsqVenueCb) {
                    if(fsqVenue){
                        console.log('updating '+scrape.data.name);
                    }
                    updateScrape(scrape, fsqVenue, fsqVenueCb);
                }
            ], function (waterfallError, results) {
                forEachScrapeCb(waterfallError);
            })

        }, function (forEachError) {
            if (forEachError) {
                console.log(forEachError);
            }
            console.log('done');
            process.exit(0);
        });
    })

})
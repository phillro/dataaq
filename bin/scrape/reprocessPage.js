/**
 * User: philliprosen
 * Date: 11/3/12
 * Time: 9:05 PM
 */



var async = require('async'),
    nodeio = require('node.io'),
    mongoose = require('mongoose'),
    InputQueue = require('../../lib/InputQueue').InputQueue,
    ProxyQueue = require('../../lib/ProxyQueue').ProxyQueue,
    JobQueue = require('../../lib/JobQueue').JobQueue,
    cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util');

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf'],
    scrapeId:['s', 'scrape id to reprocess', 'string', '5096010583d463c34100000f']
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
    var mongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(mongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    mongooseLayer.models.Scrape.find({network:'nymag'}, {}, {sort:{updatedAt:1}}, function (err, scrapes) {

        if (err) {
            console.log(err);
            process.exit(0);
        } else {
            async.forEachLimit(scrapes,1, function (scrape, callback) {
                var NodeJobFactory = require(conf.jobRoot + 'networks/internal/reprocessScrape');
                var ProcessorMethods = false;
                switch (scrape.network) {
                    case 'yelp':
                        ProcessorMethods = require(conf.jobRoot + 'networks/yelp/YelpDetailsProcessor');
                        break;
                    case 'menupages':
                        ProcessorMethods = require(conf.jobRoot + 'networks/menupages/DetailProcessor');
                        break;
                    case 'nymag':
                        ProcessorMethods = require(conf.jobRoot + 'networks/nymag/DetailProcessor');
                        break;
                }
                if (ProcessorMethods) {
                    var options = {};
                    if (ProcessorMethods.processingMethod) {
                        options.processingMethod = ProcessorMethods.processingMethod
                    }
                    if (ProcessorMethods.updateScrapeMethod) {
                        options.updateScrapeMethod = ProcessorMethods.updateScrapeMethod || false;
                    }
                    if (ProcessorMethods.postProcessingMethod) {
                        options.postProcessingMethod = ProcessorMethods.postProcessingMethod || false;
                    }
                    var nodeJob = NodeJobFactory.createJob([scrape], options)
                    nodeio.start(nodeJob, {redisClient:redisClient, models:mongooseLayer.models}, function () {
                        console.log('Reprocess scrape job Complete');
                        process.exit(1);
                    })
                }
            }, function (forEachError) {
                if(forEachError){
                    console.log(forEachError);
                }
                console.log('done');
                process.exit(0);
            });
        }
    })

})
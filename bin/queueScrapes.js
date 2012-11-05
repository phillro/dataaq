var async = require('async'),
    nodeio = require('node.io'),
    InputQueue = require('../lib/InputQueue').InputQueue,
    ProxyQueue = require('../lib/ProxyQueue').ProxyQueue,
    JobQueue = require('../lib/JobQueue').JobQueue;

var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    nodeio = require('node.io'),
    InputQueue = require('../lib/InputQueue').InputQueue,
    ProxyQueue = require('../lib/ProxyQueue').ProxyQueue,
    mongoose=require('mongoose'),
    JobQueue = require('../lib/JobQueue').JobQueue,
    Job = require('../lib/JobQueue').Job

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../etc/conf']
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
    var jobQueue = new JobQueue('insiderpagesdetails', {redisClient:redisClient})

    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(ordrinMongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    mongooseLayer.models.Scrape.find({network:'insiderpages'},function(err,scrapes){
        async.forEach (scrapes,function(scrape, callback){
            var detailsJob = new Job('insiderpages', 'insiderpagesdetails', {input:[scrape.data.url], scrapeId:scrape._id.toString()}, 'cli');
            detailsJob.processorMethods = 'networks/insiderpages/DetailProcessor';
            detailsJob.baseJob = 'networks/internal/defaultPageScraper';
            jobQueue.push(detailsJob, callback);

        },function(forEachError){
            if(err){
                        console.log(err);
                    }
                    console.log('done.');
                    process.exit(1);
        });
    })

})
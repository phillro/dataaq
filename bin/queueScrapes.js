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
    mongoose = require('mongoose'),
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
    var network='citysearch';
    var jobQueue = new JobQueue(network+'details3', {redisClient:redisClient})

    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(ordrinMongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});



    var zips = ['10280', '10005', '10038', '10002', '10009', '10004', '10011', '10003', '10014'];
    mongooseLayer.models.Scrape.find({network:'citysearch','data.zip':{$in:zips}}, function (err, scrapes) {
    //mongooseLayer.models.Scrape.find({_id:'509ede106a7d96211b000b5e'}, function (err, scrapes) {
        async.forEach(scrapes, function (scrape, callback) {
            /*var url = scrape.data.url.replace('/listings/restaurant/','/urr/listings/restaurant/').replace('index.html','')+'?sort=recent';
            url=url.replace('/pages/nymag/','http://')
            var processor = 'ReviewProcessor';
            console.log(url);*/
            var processor = 'DetailProcessor';
            url= scrape.data.url.replace('/pages/nymag/','http://');
            var detailsJob = new Job(network, network+'details', {input:[url], scrapeId:scrape._id.toString()}, 'cli');
            detailsJob.processorMethods = 'networks/'+network+'/'+processor;
            detailsJob.baseJob = 'networks/internal/defaultPageScraper';
            jobQueue.push(detailsJob, callback);

        }, function (forEachError) {
            if (err) {
                console.log(err);
            }
            console.log('done.');
            process.exit(1);
        });
    })

})
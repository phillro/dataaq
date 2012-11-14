/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 9:42 PM
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
    VenueUtil = require('venue-util'),
    uuid = require('node-uuid');

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf'],
    max:['m', 'Max to run concurrently', 'number', 4],
    jobqueuename:['q', 'Job queue name', 'string', 'yepdet']
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

    var mongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(mongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);
    var Job = require('../../lib/JobQueue.js').Job;


/*
    var url = 'http://www.menupages.com/restaurants/nobu/';

    var job = new Job('menupages', 'menupagesdetail', {input:[url]}, 'cli');
    job.processorMethods = 'networks/menupages/DetailProcessor';
    job.baseJob = 'networks/internal/defaultPageScraper';*/
    var menuUrl = 'http://www.menupages.com/restaurants/nobu/menu';
    var job = new Job('menupages', 'menupagesmenu', {input:[menuUrl], scrapeId:'50a2c742b024e11605000009'}, 'cli');
    job.processorMethods = 'networks/menupages/MenuProcessor';
    job.baseJob = 'networks/internal/defaultPageScraper';


    //jobQueue.push(job);
    console.log(conf.jobRoot + job.baseJob);
    var NodeJobFactory = require(conf.jobRoot + job.baseJob);
    var options = {};

    console.log(conf.jobRoot + job.processorMethods);
    var ProcessorMethods = require(conf.jobRoot + job.processorMethods);
    if (ProcessorMethods.processingMethod) {
        if (ProcessorMethods.processingMethod) {
            options.processingMethod = ProcessorMethods.processingMethod
        }
        if (ProcessorMethods.updateScrapeMethod) {
            options.updateScrapeMethod = ProcessorMethods.updateScrapeMethod || false;
        }
        if (ProcessorMethods.postProcessingMethod) {
            options.postProcessingMethod = ProcessorMethods.postProcessingMethod || false;
        }

        if (job.opts && job.opts.scrapeType) {
            options.scrapeType = job.opts.scrapeType;
        }
        if (job.opts && job.opts.jobQueueName) {
            options.jobQueueName = job.opts.jobQueueName;
        }
        if (job.opts && job.opts.proxyQueueName) {
            options.proxyQueueName = job.opts.proxyQueueName;
        }

        var nodeJob = NodeJobFactory.createJob([job], options)
        nodeio.start(nodeJob, {redisClient:redisClient, models:mongooseLayer.models}, function () {
            console.log('Process Scrape Queue Job Complete');
            process.exit(1);
        })
    } else {
        console.log('Skipping. No processorMethods')
        process.exit(1);
    }

})
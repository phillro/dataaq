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
    VenueUtil = require('venue-util');

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf']
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
    var jobQueue = new JobQueue('yelppagedetails', {redisClient:redisClient})

    function processQueue(cb) {
        jobQueue.getNext(function (err, job) {
            if (err) {
                cb(err);
            } else {
                if (job) {
                    jobQueue.push(job);
                    console.log(conf.jobRoot + job.baseJob);
                    var NodeJobFactory = require(conf.jobRoot + job.baseJob);
                    var options = {};
                    if (job.processorMethods) {
                        var ProcessorMethods = require(conf.jobRoot + job.processorMethods);
                        if (ProcessorMethods.processingMethod) {
                            options.processingMethod = ProcessorMethods.processingMethod
                        }
                        if (ProcessorMethods.updateScrapeMethod) {
                            options.updateScrapeMethod = ProcessorMethods.updateScrapeMethod || false;
                        }
                        if (ProcessorMethods.postProcessingMethod) {
                            options.postProcessingMethod = ProcessorMethods.postProcessingMethod || false;
                        }
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
                        cb(undefined)
                    })
                } else {
                    cb()
                }
            }
        })
    }

    function runQueue() {
        processQueue(function (err, res) {
            setTimeout(runQueue, 500)
        })
    }

    runQueue();

})
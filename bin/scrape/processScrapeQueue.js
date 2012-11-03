var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),

mongoose = require('mongoose'),
    redis = require('redis'),
    InputQueue = require('../../lib/InputQueue').InputQueue,
    ProxyQueue = require('../../lib/ProxyQueue').ProxyQueue,
    JobQueue = require('../../lib/JobQueue').JobQueue

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

    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(ordrinMongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);
    var jobQueue = new JobQueue('default', {redisClient:redisClient})
    //var options = require('../../lib/jobs/networks/processScrapeQueue').options;
    //var methods = require('../../lib/jobs/networks/processScrapeQueue').methods;

    function processQueue() {
        jobQueue.getNext(function (err, job) {
            if (err) {
                console.log(err);
                process.exit(1);
            } else {
                if (job) {
                    async.waterfall([
                        function runJob(runJobCb) {
                            var jobFile = require('../../lib/jobs/networks/' + job.network + '/' + job.type);
                            var jobOptions = jobFile.options;
                            var jobMethods = jobFile.methods;
                            var nodeio = require('node.io');
                            var processScrapeQueueJob = new nodeio.Job(jobOptions, jobMethods);
                            processScrapeQueueJob.input = function (start, num, inCb) {
                                if (job.input.length > 0) {
                                    inCb([job.input.pop()]);
                                } else {
                                    inCb(false);
                                }
                            }

                            nodeio.start(processScrapeQueueJob, {redisClient:redisClient, mongooseLayer:mongooseLayer}, function () {
                            //nodeio.start(processScrapeQueueJob, {redisClient:redisClient}, function () {
                                console.log('Process Scrape Queue Job Complete');
                                runJobCb()
                            })
                        }
                    ], function (waterfallError, results) {
                        processQueue()
                    })

                } else {
                    setTimeout(processQueue, 1000)
                }
            }
        })
    }

    processQueue()

})
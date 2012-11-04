/**
 * User: philliprosen
 * Date: 11/3/12
 * Time: 6:37 PM
 */


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
    JobQueue = require('../lib/JobQueue').JobQueue

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
    var total = 11393;
    var done = 0;
    var jobQueue = new JobQueue('yelppagedetails', {redisClient:redisClient})
    async.whilst(function(){
        return done<=total;
    },function(cb){
        jobQueue.getNext(function(err,job){
            job.type='yelpDetails';
            job.baseJob='networks/internal/defaultPageScraper';
            job.processorMethods='networks/yelp/YelpDetailsProcessor';
            job.opts.jobQueueName = 'yelppagedetails';
            done++;
            jobQueue.push(job,cb);
        })
    },function(err){
        if(err){
            console.log(err);
        }
        console.log('done.');
        process.exit(1);
    })

})
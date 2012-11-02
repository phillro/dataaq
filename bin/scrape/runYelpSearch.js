/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 4:17 PM
 */



var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    nodeio = require('node.io'),
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

    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);

    /* var jobQueue = JobQueue('default', {redisClient:redisClient})
     var proxyQueue = new require('../../lib/ProxyQueue').ProxyQueue('default', {redisClient:redisClient})
     */
    var options = require('../../lib/jobs/networks/yelp/yelpSearch').options;
    var methods = require('../../lib/jobs/networks/yelp/yelpSearch').methods;

    var yelpSearchJob = new nodeio.Job(options, methods);
    var yelpInputQueue = new InputQueue('yelpsearchinputqueue', {redisClient:redisClient});

    yelpSearchJob.input = function (start, num, cb) {
        yelpInputQueue.getNext(function (err, res) {
            if (err) {
                cb(false);
            } else {
                if (res) {
                    cb([JSON.parse(res)]);
                } else {
                    cb(false);
                }
            }
        })

    }

    var i1 = {
        find_desc:'restaurants',
        find_loc:'10014',
    }

    yelpInputQueue.push(JSON.stringify(i1), function (err, res) {
        nodeio.start(yelpSearchJob, {redisClient:redisClient}, function (err, results) {
            if (err) {
                console.log(err)
            } else {
                console.log(results)
            }
            console.log('Yelp Search  Job Complete')
        })
    })

})
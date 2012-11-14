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
    InputQueue = require('../../lib/InputQueue.js').InputQueue,
    ProxyQueue = require('../../lib/ProxyQueue.js').ProxyQueue,
    JobQueue = require('../../lib/JobQueue.js').JobQueue

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
    var options = require('../../lib/jobs/networks/yelp/yelpSearch.js').options;
    var methods = require('../../lib/jobs/networks/yelp/yelpSearch.js').methods;

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

        /*
    var zones = [
         {
             find_desc:'restaurants',
             find_loc:'10014',
         },
         {
             find_desc:'restaurants',
             find_loc:'10003',
         },
         {
             find_desc:'restaurants',
             find_loc:'10011',
         },
         {
             find_desc:'restaurants',
             find_loc:'10004',
         },
         {
             find_desc:'restaurants',
             find_loc:'10009',
         },
         {
             find_desc:'restaurants',
             find_loc:'10002',
         },
         {
             find_desc:'restaurants',
             find_loc:'10038',
         },
         {
             find_desc:'restaurants',
             find_loc:'10005',
         },
         {
             find_desc:'restaurants',
             find_loc:'10280',
         },
     ];*/

    var zones = [
        {
            find_loc:'10013',
            find_desc:'restaurants'
        }
    ]

    async.forEach (zones,function(zone, callback){
        yelpInputQueue.push(JSON.stringify(zone), callback);
    },function(forEachError){
        nodeio.start(yelpSearchJob, {redisClient:redisClient}, function (err, results) {
            if (err) {
                console.log(err)
            }
            console.log('Yelp Search  Job Complete')
            process.exit(1);
        })
    });

})
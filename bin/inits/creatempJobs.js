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
    uuid = require('node-uuid');

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf'],
    max:['m', 'Max to run concurrently', 'number', 4]
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

    var network = 'menupages';
    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);
    var jobQueue = new JobQueue('10013', {redisClient:redisClient})

    var zones = [
   /*     {
            find_desc:'restaurants',
            find_loc:'10014',
            count:4
        },
        {
            find_desc:'restaurants',
            find_loc:'10003',
            count:7
        },
        {
            find_desc:'restaurants',
            find_loc:'10011',
            count:4
        },
        {
            find_desc:'restaurants',
            find_loc:'10004',
            count:1,
        },
        {
            find_desc:'restaurants',
            find_loc:'10009',
            count:3
        },
        {
            find_desc:'restaurants',
            find_loc:'10002',
            count:4
        },
        {
            find_desc:'restaurants',
            find_loc:'10038',
            count:2
        },
        {
            find_desc:'restaurants',
            find_loc:'10005',
            count:1
        },*/
        {
            find_desc:'restaurants',
            find_loc:'10013',
            count:5
        },
    ];

    var Job = require('../../lib/JobQueue.js').Job;
    async.forEach(zones, function (zone, callback) {
        var j = 1;
        async.whilst(
            function () {
                return j <= zone.count;
            },
            function (cb) {
                var url = 'http://www.menupages.com/restaurants/adv/___' + zone.find_loc + '/all-areas/all-neighborhoods/all-cuisines/' + j + '/'
                var opts = {
                    input:[url]
                }
                var job = new Job(network, 'menupagessearch', opts, 'cli');
                job.processorMethods = 'networks/menupages/SearchResultProcessor';
                job.baseJob = 'networks/internal/defaultPageScraper';
                j++;
                jobQueue.push(job, cb);
            },
            function (err) {
                callback(err);
            }
        )
    }, function (forEachError) {
        console.log('done');
        process.exit(0);
    });

})
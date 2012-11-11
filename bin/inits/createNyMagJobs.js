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
    max:['m', 'Max to run concurrently', 'number', 1]
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

    var network = 'nymag';
    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);
    var jobQueue = new JobQueue('default', {redisClient:redisClient})
    var Job = require('../../lib/JobQueue.js').Job;
    var pages = [];
    var pp =25;
    for (var i = 1; i < 186; i++) {
        pages.push(i);
    }
    async.forEach(pages, function (page, callback) {
        var offset=(page*pp)-pp+1;
        var url = 'http://nymag.com/srch?t=restaurant&No='+offset+'&N=265&q=Listing%20Type%3ARestaurants&Ns=nyml_sort_name%7C0';
        console.log(url);
        var opts = {
            input:[url]
        }
        var job = new Job(network, network+'results', opts, 'cli');
        job.processorMethods = 'networks/'+network+'/SearchResultProcessor';
        job.baseJob = 'networks/internal/defaultPageScraper';
        jobQueue.push(job, callback);
        //callback();
    }, function (forEachError) {
        console.log('done');
        process.exit(0);
    });

})
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

    var network = 'citysearch';
    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);
    var jobQueue = new JobQueue('citysearchresults', {redisClient:redisClient})
    var Job = require('../../lib/JobQueue').Job;
    var pages = [];
    for (var i = 1; i < 1802; i++) {
        pages.push(i);
    }
    async.forEach(pages, function (page, callback) {
        var url = 'http://newyork.citysearch.com/listings/manhattan-ny/restaurants/82090?where=Manhattan%2C+NY&what=restaurants&page=' + page;
        console.log(url);
        var opts = {
            input:[url]
        }
        var job = new Job(network, 'citysearchresults', opts, 'cli');
        job.processorMethods = 'networks/citysearch/SearchResultProcessor';
        job.baseJob = 'networks/internal/defaultPageScraper';
        jobQueue.push(job, callback);
    }, function (forEachError) {
        console.log('done');
        process.exit(0);
    });

})
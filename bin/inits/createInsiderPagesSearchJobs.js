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

    var network = 'insiderpages';
    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);
    var jobQueue = new JobQueue('default', {redisClient:redisClient})
    var Job = require('../../lib/JobQueue.js').Job;
    var pages = [];
    for (var i = 1; i < 102; i++) {
        pages.push(i);
    }
    async.forEach(pages, function (page, callback) {
        var url='http://www.insiderpages.com/s/NY/Manhattan/Restaurants?cs_category=Restaurants&page='+page;
        console.log(url);
        var opts = {
            input:[url]
        }
        var job = new Job(network, network+'results', opts, 'cli');
        job.processorMethods = 'networks/'+network+'/SearchResultProcessor';
        job.baseJob = 'networks/internal/defaultPageScraper';
        jobQueue.push(job, callback);
    }, function (forEachError) {
        console.log('done');
        process.exit(0);
    });

})
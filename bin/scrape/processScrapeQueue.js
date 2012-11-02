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

    var options = require('../../lib/jobs/networks/processScrapeQueue').options;
    var methods = require('../../lib/jobs/networks/processScrapeQueue').methods;

    var processScrapeQueueJob = new nodeio.Job(options, methods);

    nodeio.start(processScrapeQueueJob, {redisClient:redisClient}, function (err, results) {
        if (err) {
            console.log(err)
        } else {
            console.log(results)
        }
        console.log('Process Scrape Queue Job Complete');
        process.exit(1);
    })

})
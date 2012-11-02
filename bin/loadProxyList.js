/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 6:05 PM
 */



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

    var proxyQueue = new ProxyQueue('default', {redisClient:redisClient});

    var proxies = require('../etc/proxies').proxies;
    proxyQueue.clear(function (err, res) {
        async.forEach(proxies, function (proxy, callback) {
            proxyQueue.add(proxy, callback);
        }, function (forEachError) {
            console.log('loaded proxies')
            process.exit(1);
        });
    })

})
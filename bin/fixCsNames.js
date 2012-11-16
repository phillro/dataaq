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
    mongoose = require('mongoose'),
    JobQueue = require('../lib/JobQueue').JobQueue,
    Job = require('../lib/JobQueue').Job

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
    var jobQueue = new JobQueue('insiderpagesdetails', {redisClient:redisClient})

    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(ordrinMongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    mongooseLayer.models.RestaurantMerged.find({'name_meta.meta_phones':{$in:['STSRKSH', 'WNR']}}, function (err, rests) {
        async.forEachLimit(rests, 20, function (rest, callback) {
            if(rest.name.indexOf('Best of Citysearch Winner')>-1){
                console.log('found cs w')
                rest.name=rest.name.replace('Best of Citysearch Winner','');
                rest.save(callback);
            }else{
                callback();
            }
        }, function (forEachError) {
            if (err) {
                console.log(err);
            }
            console.log('done.');
            process.exit(1);
        });
    })

})
var async = require('async'),
    nodeio = require('node.io'),
    InputQueue = require('../../lib/InputQueue').InputQueue,
    ProxyQueue = require('../../lib/ProxyQueue').ProxyQueue,
    JobQueue = require('../../lib/JobQueue').JobQueue;

var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    nodeio = require('node.io'),
    InputQueue = require('../../lib/InputQueue').InputQueue,
    ProxyQueue = require('../../lib/ProxyQueue').ProxyQueue,
    mongoose = require('mongoose'),
    JobQueue = require('../../lib/JobQueue').JobQueue,
    Job = require('../../lib/JobQueue').Job,
    Comparer = require('../../lib/Comparer'),
    natural = require('natural');

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
    var jobQueue = new JobQueue('insiderpagesdetails', {redisClient:redisClient})

    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(ordrinMongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    var zips = ['10014', '10003', '10011', '10004', '10009', '10002', '10038', '10005', '10280'];
    var excludeAddKeywords = ['office', 'po box', 'p.o. box'];
    var excludeNameKeywords = [];

    async.waterfall([
        function excludeStats(cb) {
            mongooseLayer.models.RestaurantMerged.count({excluded:true}, function (err, count) {
                console.log('Total excluded ' + count);
                cb(err);
            })
        },
        function excludedUndefGeo(cb) {
            mongooseLayer.models.RestaurantMerged.update({geo:null}, {$set:{excluded:true, enabled:false}}, {multi:true}, function (err, uRes) {
                cb(err);
            })
        },
        function excludeNoName(cb) {
            mongooseLayer.models.RestaurantMerged.update({name:null}, {$set:{excluded:true, enabled:false}}, {multi:true}, function (err, uRes) {
                cb(err);
            })
        },
        function excludeAddrKeywords(cb) {
            var excludeIds = [];
            mongooseLayer.models.RestaurantMerged.find({excluded:{$ne:true}}, {addr:1}, function (err, rests) {
                if (err) {
                    cb(err);
                } else {
                    async.forEach(rests, function (rest, callback) {
                        if (excludeAddKeywords.indexOf(rest.addr.toLowerCase()) > -1) {
                            excludeIds.push(rest._id.toString());
                        }
                        callback();
                    }, function (forEachError) {
                        if (excludeIds.length > 0) {
                            mongooseLayer.models.RestaurantMerged.update({_id:{$in:excludeIds}}, {$set:{excluded:true, enabled:false}}, {multi:true}, function (err, uRes) {
                                cb(err);
                            })
                        } else {
                            cb(forEachError);
                        }
                    });
                }
            })
            mongooseLayer.models.RestaurantMerged.update({addr:null}, {$set:{excluded:true, enabled:false}}, {multi:true}, function (err, uRes) {
                cb(err);
            })
        },
        function excludeStats(cb) {
            mongooseLayer.models.RestaurantMerged.count({excluded:true}, function (err, count) {
                console.log('Total excluded ' + count);
                cb(err);
            })
        }
    ], function (waterfallError, results) {
        if (waterfallError) {
            console.log(waterfallError);
        }
        console.log('done');
        process.exit(1);
    })

})
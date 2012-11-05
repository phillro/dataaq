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

    var checked = 0;
    var found = 0;
    var nameAddrFound = 0;
    var namePhoneFound = 0;
    var zips = ['10014', '10003', '10011', '10004', '10009', '10002', '10038', '10005', '10280'];
    var query = {'data.name_meta':{$exists:true}, 'data.address_meta':{$exists:true}, 'data.zip':{$in:zips}};
    mongooseLayer.models.Scrape.find(query, {}, {sort:{createdAt:-1}}, function (err, scrapes) {
            //mongooseLayer.models.Scrape.find({'data.name_meta':{$exists:true}, 'data.address_meta':{$exists:true}}, function (err, scrapes) {
            async.forEachLimit(scrapes, 20, function (scrape, forEachCallback) {
                checked++;
                async.waterfall([
                    function suggestExisting(cb) {
                        Comparer.suggestRestaurant(mongooseLayer, scrape, function (err, scrape, existingRestaurant, reason) {
                            if (existingRestaurant) {
                                found++;
                            }
                            cb(err, scrape, existingRestaurant, reason);
                        })
                    },
                    function pair(scrape,restaurant,reason,cb){
                        if(scrape&&restaurant){
                            scrape.reason = reason;
                            scrape.locationId = restaurant._id;
                            console.log('Pairing '+scrape._id+' to '+restaurant._id);
                            scrape.save(function(err,scrape){
                                cb(err, scrape, restaurant, reason);
                            })
                        }else{
                            cb(err, scrape, false, false);
                        }
                    }
                ], function (waterfallError, results) {
                    forEachCallback(waterfallError)
                })

            }, function (forEachError) {
                if (err) {
                    console.log(err);
                }
                console.log('done. ' + found + '/' + checked);
                process.exit(1);
            });
        }

    )

})
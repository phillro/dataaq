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
    var query = {locationId:{$exists:true}};

    function getScrapes(start, num, cb) {
        mongooseLayer.models.Scrape.find(query, {}, {skip:start, limit:num, sort:{createdAt:-1}}, function (err, scrapes) {
            cb(err, scrapes);
        })
    }

    var done = 0;
    var pageSize = 100;
    var checked = 0;
        var found = 0;
    mongooseLayer.models.Scrape.count(query, function (err, total) {
        async.whilst(function () {
            return done < total - 1;
        }, function (wCb) {
            getScrapes(done, pageSize, function (err, scrapes) {
                async.forEachLimit(scrapes, 20, function (scrape, forEachCallback) {
                    checked++;
                    async.waterfall([
                       function isDupe(isDupeCb){
                           mongooseLayer.models.RestaurantMerged.findOne({_id:scrape.locationId,deduped_id:{$exists:true}},{deduped_id:1},function(err,rest){
                               if(rest){
                                   found++;
                                   scrape.locationId=rest.deduped_id;
                                   scrape.save(isDupeCb);
                               }else{
                                   isDupeCb();
                               }
                           })
                       }
                    ], function (waterfallError, results) {
                        done++;
                        forEachCallback(waterfallError);
                    })

                }, function (forEachError) {
                    console.log('Completed '+done+' found '+found);
                    wCb(forEachError);
                });
            })
        }, function (wError) {
            if (wError) {
                console.log(wError);
            }
            console.log('done. ' + found + '/' + checked);
            process.exit(1);
        })
    })

})
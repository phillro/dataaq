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
    var nameAddrFound = 0;
    var namePhoneFound = 0;
    var zips = ['10014', '10003', '10011', '10004', '10009', '10002', '10038', '10005', '10280'];
    var query ={'data.name_meta':{$exists:true}, 'data.address_meta':{$exists:true}, 'data.zip':{$in:zips}};
    mongooseLayer.models.Scrape.find(query, {}, {sort:{createdAt:-1}}, function (err, scrapes) {
            //mongooseLayer.models.Scrape.find({'data.name_meta':{$exists:true}, 'data.address_meta':{$exists:true}}, function (err, scrapes) {
            async.forEachLimit(scrapes, 20, function (scrape, forEachCallback) {
                async.waterfall([
                    function findLocationByNameAndAdd(cb) {
                        checked++;
                        mongooseLayer.models.RestaurantMerged.find({name_meta:scrape.data.name_meta, addr_meta:scrape.data.address_meta, enabled:{$ne:false}}, {}, {createdAt:-1}, function (err, restaurants) {
                            if (restaurants.length > 0) {
                                scrape.pair_reason = 'Name and Address Match.';
                                nameAddrFound++;
                                scrape.locationId = restaurants[0]._id;
                                scrape.rename_candidate = false;
                                scrape.save(function (err, savedScrape) {
                                    cb(err);
                                });
                            }
                            else {
                                cb(undefined);
                            }
                        })
                    },
                    function findLocationByNameAndPhone(cb) {
                        if (scrape.data && !scrape.locationId && scrape.data.norm_phone && scrape.data.norm_phone.trim().length >= 7) {
                            mongooseLayer.models.RestaurantMerged.find({name_meta:scrape.data.name_meta, norm_phone:scrape.data.norm_phone, enabled:{$ne:false}}, {}, {createdAt:-1}, function (err, restaurants) {
                                if (restaurants.length > 0) {
                                    scrape.pair_reason = 'Name and Phone Match.';
                                    namePhoneFound++;
                                    scrape.locationId = restaurants[0]._id;
                                    scrape.rename_candidate = false;
                                    scrape.save(function (err, savedScrape) {
                                        cb(err, restaurants, savedScrape);
                                    });
                                }
                                else {
                                    cb(err, restaurants);
                                }
                            })
                        } else {
                            cb(undefined);
                        }
                    },
                    function findLocationByPhone(cb) {
                        if (scrape.data && !scrape.locationId && scrape.data.norm_phone && scrape.data.norm_phone.trim().length >= 7) {
                            mongooseLayer.models.RestaurantMerged.find({norm_phone:scrape.data.norm_phone, enabled:{$ne:false}}, {}, {createdAt:-1}, function (err, restaurants) {
                                if (restaurants.length > 0) {
                                    var candidate = restaurants[0];
                                    var scrapeMetaName = '';
                                    var candidateMetaName = '';
                                    for (var i = 0; i < candidate.name_meta.meta_phones.length; i++) {
                                        if (i > 0) {
                                            candidateMetaName += ' ';
                                        }
                                        candidateMetaName += candidate.name_meta.meta_phones[i];
                                    }

                                    for (var i = 0; i < scrape.data.name_meta.meta_phones.length; i++) {
                                        if (i > 0) {
                                            scrapeMetaName += ' ';
                                        }
                                        scrapeMetaName += scrape.data.name_meta.meta_phones[i];
                                    }

                                    var similairity = natural.JaroWinklerDistance(candidateMetaName, scrapeMetaName)
                                    if (similairity > .75) {
                                        scrape.pair_reason = 'Phone Match. Name similairity exceeds .75';
                                        scrape.rename_candidate = false;
                                        namePhoneFound++;
                                        scrape.locationId = restaurants[0]._id;

                                    } else {
                                        scrape.rename_candidate = true;
                                    }
                                    scrape.save(function (err, savedScrape) {
                                        cb(err, restaurants, {});
                                    });

                                }
                                else {
                                    cb(err, restaurants);
                                }
                            })
                        } else {
                            cb(undefined, []);
                        }
                    }
                ], function (waterfallError, results) {
                    forEachCallback(waterfallError)
                })

            }, function (forEachError) {
                if (err) {
                    console.log(err);
                }
                console.log('done. ' + nameAddrFound + ',' + namePhoneFound + '/' + checked);
                process.exit(1);
            });
        }

    )

})
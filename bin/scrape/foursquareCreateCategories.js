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
    uuid = require('node-uuid'),
    FsqClient = require('foursquarevenues')

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

    var network = 'foursquare';
    var redisClient = redis.createClient(conf.redis.port, conf.redis.host);
    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var dbConn = mongoose.createConnection(ordrinMongoConnectionString);
    var mongooseLayer = new VenueUtil.mongo(dbConn, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    var foursquare = new FsqClient('TYR00ZTQ44Q5E0NOWHBJSZLXFRKK1MZUCF1NJ0WWPTK1IG01', 'SNT2F4NQC0QKP0DSRXFR1ZUV1PPA0LIUAGBNWO2S3N2XDLC3')

    var params = {
        "ll":"40.7,-74"
    };

    function createFCatFromFsq(cat, parentId, createFCatFromFsqCb) {
        var fsq = new mongooseLayer.models.Fsqcat(cat);
        fsq.fsqid=cat.id;
        if (parentId) {
            fsq.parentId = parentId;
            fsq.isRoot = false;
        } else {
            fsq.isRoot = true;
        }
        fsq.save(function (err, savedFsq) {
            savedFsq.childrenIds=[];
            if(savedFsq.categories.length>0){
                async.forEach (savedFsq.categories,function(childCat, forEachCallback){
                    createFCatFromFsq(childCat,savedFsq._id,function(cErr,savedChildCat){
                        savedFsq.childrenIds.push(savedChildCat._id);
                        forEachCallback(cErr);
                    })
                },function(forEachError){
                    savedFsq.childrenCount=savedFsq.childrenIds.length;
                    savedFsq.save(createFCatFromFsqCb);
                });
            }else{
                createFCatFromFsqCb(err,savedFsq);
            }

        })
    }

    function createFcats(catMaps, parentId, createFcatsCb) {
        var fcats = [];
        async.forEachSeries(catMaps, function (catMap, forEachCb) {
            var children = catMap.categories;
            catMap.categories = null;
            async.waterfall([
                function (cb) {
                    var fsq = new mongooseLayer.models.Fsqcat(catMap);
                    if (parentId) {
                        fsq.parentId = parentId;
                    }
                    else {
                        fsq.isRoot = true;
                    }
                    fsq.save(function (err, savedCat) {
                        cb(err, savedCat);
                    })
                },
                function createChildren(fcat, createChildrenCb) {
                    var childrendIds = [];
                    if (children) {
                        createFcats(children, fcat._id, function (err, fcats) {
                            if (err) {
                                createChildrenCb(err, fcat);
                            } else {
                                for (var i = 0; i < fcats.length; i++) {
                                    childrendIds.push(fcats[i]._id);
                                }
                                fcat.childrenIds = childrendIds;
                                fcat.childrenCount = childrendIds.length;
                                createChildrenCb(undefined, fcat);
                            }
                        })
                    } else {
                        fcat.childrenCount = childrendIds.length;
                        fcat.childrenIds = childrendIds;
                        createChildrenCb(undefined, fcat);
                    }
                },
                function saveFinal(fcat, cb) {
                    fcat.save(cb);
                }
            ], function (waterfallError, fcat) {
                fcats.push(fcat);
                forEachCb(waterfallError)
            })

        }, function (forEachError) {
            createFcatsCb(forEachError, fcats);
        });

    }



    async.waterfall([
        /*function (cb) {
         foursquare.getVenues(params, function (error, venues) {
         if (!error) {
         console.log(venues);
         }
         cb();
         });
         },*/
        function (cb) {
            foursquare.getCategories(params, function (error, res) {
                var categories = res.response.categories;

                async.forEach(categories, function (cat, forEachCallback) {
                    createFCatFromFsq(cat,undefined,forEachCallback);
                }, function (forEachError) {
                    cb(forEachError);
                });
            });
        }
    ], function (waterfallError, results) {
        if (waterfallError) {
            console.log(waterfallError);
        }
        console.log('done');
        process.exit(0);
    })

})
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

    var zips = ['10280', '10005', '10038', '10002', '10009', '10004', '10011', '10003', '10014']
    var params = {
        "ll":"40.7,-74",
        "limit":50,
        "categoryId":"4d4b7105d754a06374d81259",
        "radios":200
    };

    function createScrapeFromFoursquareVenue(venue, cb) {
        var valueFields = {
            name:'name',
            'url':'url',
            'specials':'fsqspecials',
            'stats':'fsqstats',
            'categories':'fsqcategories',
            'likes':'fsqlikes',
            'menu':'fsqmenu'
        }
        var data = false;
        if (venue.location && venue.name) {
            var scrape = new mongooseLayer.models.Scrape({type:'location', network:'foursquare', params:params});
            data = {};
            data.zip = venue.location.postalCode;
            venue.location.distance = null;
            if (venue.location.lat && venue.location.lng) {
                data.geo = {
                    lat:venue.location.lat,
                    lon:venue.location.lng
                };
                venue.location.lng = null;
                venue.location.lat = null;
            }
            for (var f in venue.location) {
                if (venue.location[f]) {
                    data[f] = venue.location[f];
                }
            }
            data.phone = venue.contact.formattedPhone ? venue.contact.formattedPhone : null;
            data.twitter = venue.contact.twitter ? venue.contact.twitter : null;
            data.fsqid = venue.id;
            for (var f in valueFields) {
                data[valueFields[f]] = venue[f];
            }
            scrape.lastChecked = new Date();
            scrape.data = data;
            scrape.markModified('data');
            scrape.save(cb);
        } else {
            cb(undefined, data);
        }
    }

    function venuesSearchAndSave(params, venuesSearchCb) {
        async.waterfall([
            function (cb) {
                foursquare.getVenues(params, function (error, venues) {
                    if (venues.response && venues.response.venues) {
                        async.forEach(venues.response.venues, function (venue, forEachCb) {
                            async.waterfall([
                                function checkFsqExists(checkFsqExistsCb) {
                                    mongooseLayer.models.Scrape.findOne({'data.fsqid':venue.id}, {'data.fsqid':1, 'data.name':1}, function (err, scrape) {
                                        checkFsqExistsCb(err, venue, scrape);
                                    })
                                },
                                function createScrape(venue, scrape, createScrapeCb) {
                                    if (!scrape) {
                                        createScrapeFromFoursquareVenue(venue, function (err, scrape) {
                                            createScrapeCb(err, venue, scrape);
                                        })
                                    } else {
                                        createScrapeCb(undefined, venue, scrape);
                                    }
                                }
                            ], function (waterfallError, results) {
                                forEachCb(waterfallError);
                            })
                        }, function (forEachError) {
                            cb(forEachError);
                        });
                    } else {
                        cb(error);
                    }

                });
            },
        ], function (waterfallError, results) {
            venuesSearchCb(waterfallError);
        })
    }

    async.forEach(zips, function (zip, forEachZipCb) {

        var query = {'geo.lat':{$exists:true}, 'geo.lon':{$exists:true}, postal_code:zip};

        mongooseLayer.models.RestaurantMerged.find(query, {'geo':1}, {limit:5, sort:{fsqlastchecked:1}}, function (err, restaurants) {
            if (err) {
                forEachZipCb(err);
            } else {
                async.waterfall([
                    function buildParams(buildParamsCb) {
                        var fbParams = [];
                        var r = restaurants.length;
                        var rIds = [];
                        while (r--) {
                            if (restaurants[r].geo.lat && restaurants[r].geo.lon) {
                                var params = {
                                    'll':restaurants[r].geo.lat + "," + restaurants[r].geo.lon,
                                    'limit':50,
                                    "categoryId":"4d4b7105d754a06374d81259",
                                    "radius":200
                                }
                                fbParams.push(params);
                            }
                            rIds.push(restaurants[r]._id.toString());
                        }
                        mongooseLayer.models.RestaurantMerged.update({_id:{$in:rIds}}, {$set:{fsqlastchecked:new Date()}}, {multi:true}, function (uErr, uRes) {
                            buildParamsCb(undefined, fbParams);
                        })
                    },
                    function runSearches(fbParams, runSearchesCb) {
                        async.forEachLimit(fbParams, 1, function (fbParam, forEachFbParamsCb) {
                            venuesSearchAndSave(fbParam, forEachFbParamsCb);
                        }, function (forEachError) {
                            runSearchesCb(forEachError);
                        });
                        //runSearchesCb(undefined);
                    }
                ], function (waterfallError) {
                    forEachZipCb(waterfallError);
                })
            }
        })

    }, function (forEachError) {
        if (forEachError) {
            console.log(forEachError);
        }
        console.log('done');
        process.exit(0);
    });

})
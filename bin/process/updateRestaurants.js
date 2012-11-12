var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    mongoose = require('mongoose'),
    JobQueue = require('../../lib/JobQueue').JobQueue,
    Attribution = require('venue-util/lib/Attribution.js');

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

    var attributedFields = {
        'transportation':'transportation',
        'attire':'attire',
        'parking':'parking',
        'goodformeal':'goodformeal',
        'alchohol':'alchohol',
        'ambience':'ambience',
        'noiselevel':'noiselevel',
        'creditcards':'creditcards',
        'delivery':'delivery',
        'groups':'groups',
        'kids':'kids',
        'reservations':'reservations',
        'takeout':'takeout',
        'tableservice':'tableservice',
        'outdoorseating':'outdoorseating',
        'wifi':'wifi',
        'tv':'tv',
        'caters':'caters',
        'wheelchair':'wheelchair',
        'goodviews':'goodviews',
        'features':'features',
        'cuisine':'cuisine',
        'menuJson':'menujson',
        'menuUrl':'menuurl',
        'priceString':'priceString',
        'tips':'tips',
        'fsqtips':'tips',
        fsqspecials:'fsqspecials',
        fsqphotos:'fsqphotos',
        fsqlikes:'fsqlikes',
        fsqphrases:'fsqphrases',
        fsqcatids:'fsqcatids',
        'fsqmenu':'menuurl',
        "24hours":"24hours",
       	"byob":"alchohol",
       	"barscene":"barscene",
       	"brunchdaily":"brunchdaily",
       	"buffet":"buffet",
       	"businessdining":"businessdining",
       	"businesslunch":"businesslunch",
       	"celebspotting":"celebspotting",
       	"cheapeats":"cheapeats",
       	"classicny":"classicny",
       	"deliveryafter10pm":"deliveryafter10pm",
       	"designstandout":"designstandout",
       	"dineatthebar":"dineatthebar",
       	"familystyle":"familystyle",
       	"fireplace":"fireplace",
       	"foodtruck/cart":"foodtruck",
       	"glutenfreeitems":"glutenfreeitems",
       	"greatdesserts":"greatdesserts",
       	"happyhour":"happyhour",
       	"hotspot":"hotspot",
       	"kidfriendly":"kidfriendly",
       	"kidsmenu":"kidsmenu",
       	"latenightdining":"latenightdining",
       	"liveentertainment":"liveentertainment",
       	"livemusic":"livemusic",
       	"lunchspecial":"lunchspecial",
       	"notablechef":"notablechef",
       	"notablewinelist":"notablewinelist",
       	"onlineordering":"onlineordering",
       	"onlinereservations":"onlinereservations",
       	"open24hours":"24hours",
       	"openkitchens/watchthechef":"openkitchens",
       	"openlate":"openlate",
       	"peoplewatching":"peoplewatching",
       	"pre/posttheater":"preposttheater",
       	"privatedining/partyspace":"privatedining",
       	"prixfixe":"prixfixe",
       	"rawbar":"rawbar",
       	"reservationsnotrequired":"reservationsnotrequired",
       	"romantic":"romantic",
       	"smokingarea":"smokingarea",
       	"specialoccasion":"smokingarea",
       	"tastingmenu":"tastingmenu",
       	"teatime":"teatime",
       	"teenappeal":"teenappeal",
       	"theaterdistrict":"theaterdistrict",
       	"trendy":"trendy",
       	"view":"view",
       	"waterfront":"waterfront"
    };

    var unattributedFields = {
        'neighborhoods':'neighborhoods',
        'tags':'categories',
        'website':'website',
        'email':'email',
        'zip':'postal_code'
    }

    var pageSize = 20;
    var done = 0;

    function getRestaurants(start, num, cb) {
        //mongooseLayer.models.RestaurantMerged.find({_id:'50a0b6b396be3c4a33022ac9',excluded:{$ne:true}}, {}, {skip:start, limit:num, sort:{updated_at:-1}}, function (err, restaurants) {
        mongooseLayer.models.RestaurantMerged.find({excluded:{$ne:true}}, {}, {skip:start, limit:num, sort:{updated_at:-1}}, function (err, restaurants) {
            cb(err, restaurants);
        })
    }

    function handleFeatureField(sourceField, destField, restaurant, network) {

        if (network.data) {
            if (sourceField == 'features') {
                var features = network.data[sourceField];
                for (var f2 in features) {
                    restuarant = handleFeatureField(f2, f2, restaurant, network);
                }
            } else {
                if (network.network == 'foursquare') {
                    network.params.url = 'https://foursquare.com/v/' + network.data.fsqid;
                }
                if (!restaurant.features[destField] && network.data[sourceField]) {
                    //console.log(restaurant._id);
                    restaurant.features[destField] = network.data[sourceField];
                    restaurant.feature_attributions.push({
                        attribution:new Attribution(network.network, network.params.url, network.createdAt, network._id),
                        field_name:destField
                    })
                    var t = 1;
                } else {
                    for (var j = 0; j < restaurant.feature_attributions.length; j++) {
                        if (restaurant.feature_attributions[j].field_name == destField) {
                            if (restaurant.feature_attributions[j].attribution.date.getTime < network.createdAt.getTime()) {
                                restaurant.features[destField] = network.data[sourceField];
                                restaurant.feature_attributions[j].attribution = new Attribution(network.network, network.params.url, network.createdAt, network._id)
                            }
                        }
                    }
                }
            }
        }
        return restaurant;

    }

    mongooseLayer.models.RestaurantMerged.count({}, function (err, total) {
        async.whilst(function () {
            console.log(done + ' of ' + total);
            return done < total - 1;
        }, function (wCb) {
            console.log('get restaurants');
            getRestaurants(done, pageSize, function (err, restaurants) {
                if (err) {
                    console.log(err);
                    wCb();
                } else {
                    async.forEachLimit(restaurants, 5, function (restaurant, forEachRestaurantCallback) {
                        async.waterfall([
                            function getScrapes(cb) {
                                // console.log(restaurant._id);
                                console.log('get scrapes');
                                mongooseLayer.models.Scrape.find({locationId:restaurant._id}, {}, {limit:5, sort:{createdAt:-1}}, function (err, scrapes) {
                                    cb(err, scrapes);
                                })
                            },
                            function chooseScrapes(scrapes, cb) {
                                console.log('choose scrapes');
                                var networkMap = {};
                                for (var i = 0; i < scrapes.length; i++) {
                                    var scrape = scrapes[i];
                                    if (!networkMap[scrape.network]) {
                                        networkMap[scrape.network] = scrape;
                                    } else {
                                        //Take the scrape with the most reviews, otherwise most recent
                                        if (networkMap[scrape.network].reviews && scrape.data.reviews) {
                                            if (networkMap[scrape.network].reviews.length == scrape.data.reviews.length) {
                                                networkMap[scrape.network] = networkMap[scrape.network].createdAt.getTime() > scrape.createdAt.getTime() ? networkMap[scrape.network] : scrape;
                                            } else {
                                                networkMap[scrape.network] = networkMap[scrape.network].reviews.length > scrape.data.reviews.length ? networkMap[scrape.network] : scrape;
                                            }
                                        } else {
                                            if (scrape.data.reviews) {
                                                networkMap[scrape.network] = scrape;
                                            } else {
                                                networkMap[scrape.network] = networkMap[scrape.network].createdAt.getTime() > scrape.createdAt.getTime() ? networkMap[scrape.network] : scrape;
                                            }
                                        }
                                    }
                                }
                                var networks = [];
                                for (var n in networkMap) {
                                    networks.push(networkMap[n]);
                                }
                                networks = networks.sort(function (a, b) {
                                    return b.createdAt.getTime() - a.createdAt.getTime();
                                })
                                cb(undefined, networks, networkMap);
                            },
                            function mergeScrapes(networks, networkMap, cb) {
                                console.log('merge scrapes');
                                if (!restaurant.features) {
                                    restaurant.features = {}
                                }
                                async.forEachSeries(networks, function (network, forEachSeriesCb) {
                                    //for (var i = 0; i < attributedFields.length; i++) {
                                    for (var f in attributedFields) {
                                        //var field = attributedFields[i];
                                        if (network.data[f]) {
                                            if (f == 'menuJson') {
                                                restaurant.hasFeatureMenu = true;
                                            }
                                            if (f == 'fsqmenu') {
                                                var url = network.data[f].url;
                                                network.data[f] = url;
                                            }

                                        }
                                        restaurant = handleFeatureField(f, attributedFields[f], restaurant, network);
                                    }

                                    for (var field in unattributedFields) {
                                        if (network.data[field]) {
                                            if (!restaurant._doc[field] && network.data[field]) {
                                                restaurant._doc[unattributedFields[field]] = network.data[field];
                                                restaurant.markModified(unattributedFields[field]);
                                            }
                                        }
                                    }
                                    restaurant.feature_count = 0;
                                    for (var field in restaurant.features) {
                                        restaurant.feature_count++;
                                    }

                                    if (network.data.closed) {
                                        restaurant.closed = true;
                                    }

                                    forEachSeriesCb(undefined);
                                }, function (forEachError) {
                                    cb(forEachError, networks, networkMap);
                                });
                            },
                            function updateReviews(networks, networkMap, cb) {
                                console.log('update reviews');
                                //restaurant.reviews = [];
                                var reviews = [];
                                var rContent = [];
                                for (var i = 0; i < networks.length; i++) {
                                    var network = networks[i];
                                    if (network.data.reviews) {
                                        var networkAttribution = new Attribution(network.network, network.data.url, network.createdAt, network._id);
                                        for (var j = 0; j < network.data.reviews.length; j++) {
                                            var review = network.data.reviews[j];
                                            try {
                                                if (review.dtreviewed) {
                                                    if (typeof review.dtreviewed == 'string') {
                                                        var d = new Date(review.dtreviewed);
                                                        review.dtreviewed = d;
                                                    }
                                                }
                                            } catch (ex) {
                                                review.dtreviewed = null;
                                            }
                                            review.attribution = networkAttribution;
                                            if (rContent.indexOf(review.content) == -1) {
                                                reviews.push(review);
                                                rContent.push(review.content);
                                            }
                                        }
                                    }
                                }

                                reviews = reviews.sort(function (a, b) {
                                    if (a.dtreviewed && b.dtreviewed) {
                                        try {
                                            return b.dtreviewed.getTime() - a.dtreviewed.getTime();
                                        } catch (ex) {
                                            return -1;
                                        }
                                    } else {
                                        return -1;
                                    }
                                })
                                restaurant.reviews_count = reviews.length;
                                restaurant.reviews=reviews;
                                cb(undefined, networks, networkMap)
                            },
                            function updateRatings(networks, networkMap, cb) {
                                console.log('update ratings');
                                var ratingTotal = 0;
                                var ratingCount = 0;
                                var rating = false;
                                restaurant.ratings = [];
                                for (var i = 0; i < networks.length; i++) {
                                    var network = networks[i];
                                    if (network.data.rating) {
                                        try {
                                            ratingTotal += parseFloat(network.data.rating);
                                            restaurant.ratings.push({
                                                rating:network.data.rating,
                                                attribution:new Attribution(network.network, network.data.url, network.createdAt, network._id)
                                            })
                                            ratingCount++;
                                        } catch (ex) {
                                            console.log(ex);
                                        }
                                    }
                                }
                                if (ratingCount) {
                                    rating = ratingTotal / ratingCount;
                                    restaurant.ratings_count = ratingCount;
                                    restaurant.average_rating = rating;
                                } else {
                                    restaurant.average_rating = -1;
                                }
                                if (restaurant.average_rating > 5) {
                                    var avg = restaurant.average_rating.toString();
                                    console.log('rating wtf. ');
                                }

                                cb(undefined, networks, networkMap);
                            },
                            function updateRestaurantNetworks(networks, networkMap, cb) {
                                console.log('update rest networks')
                                var network_ids = [];
                                for (var i = 0; i < networks.length; i++) {
                                    var network = networks[i];
                                    network_ids.push({
                                        name:network.network,
                                        id:network._id,
                                        scrapedAt:network.createdAt
                                    });
                                }

                                restaurant.source_count = restaurant.network_ids.length;
                                restaurant.network_ids=network_ids;
                                restaurant.markModified('network_ids');
                                cb(undefined, networks, networkMap);
                            },
                            function saveRestaurant(networks, networkMap, cb) {
                                console.log('save rest')
                                restaurant.features.menuJson=restaurant.features.menuJson?true:false;
                                restaurant.markModified('features');
                                restaurant.markModified('feature_attributions');
                                restaurant.save(function (err, restSaveRes) {
                                    cb(err, restSaveRes);
                                })
                            }
                        ], function (waterfallError, results) {
                            done++;
                            forEachRestaurantCallback(waterfallError)
                        })
                    }, function (forEachError) {
                        if (forEachError) {
                            console.log(forEachError);
                        }
                        wCb(forEachError);
                    });
                }
            })
        }, function (wErr) {
            if (wErr) {
                console.log(wErr);
            }
            console.log('done ' + done);
            process.exit(1);
        })

    })

})
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

    var attributedFields = [
        'transportation',
        'attire',
        'parking',
        'goodformeal',
        'alchohol',
        'ambience',
        'noiselevel',
        'creditcards',
        'delivery',
        'groups',
        'kids',
        'reservations',
        'takeout',
        'tableservice',
        'outdoorseating',
        'wifi',
        'tv',
        'caters',
        'wheelchair',
        'goodviews',
        'features',
        'cuisine',
        'menuJson',
        'priceString'
    ]

    mongooseLayer.models.RestaurantMerged.find({}, {}, {sort:{updatedAt:-1}, limit:50}, function (err, restaurants) {
        async.forEachLimit(restaurants, 5, function (restaurant, forEachRestaurantCallback) {
            async.waterfall([
                function getScrapes(cb) {
                    mongooseLayer.models.Scrape.find({locationId:restaurant._id}, {}, {sort:{createdAt:-1}}, function (err, scrapes) {
                        cb(err, scrapes);
                    })
                },
                function chooseScrapes(scrapes, cb) {
                    var networkMap = {};
                    for (var i = 0; i < scrapes.length; i++) {
                        var scrape = scrapes[i];
                        if (!networkMap[scrape.network]) {
                            networkMap[scrape.network] = scrape;
                        } else {
                            //Take the scrape with the most reviews, otherwise most recent
                            if (networkMap[scrape.network].reviews && scrape.reviews) {
                                if (networkMap[scrape.network].reviews.length == scrape.reviews.length) {
                                    networkMap[scrape.network] = networkMap[scrape.network].createdAt.getTime() > scrape.createdAt.getTime() ? networkMap[scrape.network] : scrape;
                                } else {
                                    networkMap[scrape.network] = networkMap[scrape.network].reviews.length > scrape.reviews.length ? networkMap[scrape.network] : scrape;
                                }
                            } else {
                                if (scrape.reviews) {
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
                    if (!restaurant.features) {
                        restaurant.features = {}
                    }
                    async.forEachSeries(networks, function (network, forEachSeriesCb) {
                        for (var i = 0; i < attributedFields.length; i++) {
                            var field = attributedFields[i];
                            if (network.data[field]) {
                                if (!restaurant.features[field]) {
                                    restaurant.features[field] = network.data[field];
                                    restaurant.feature_attributions.push({
                                        attribution:new Attribution(network.network, network.data.url, network.createdAt, network._id),
                                        field_name:field
                                    })
                                    var t = 1;
                                } else {
                                    for (var j = 0; j < restaurant.feature_attributions.length; j++) {
                                        if (restaurant.feature_attributions[j].field_name == field) {
                                            if (restaurant.feature_attributions[j].attribution.date.getTime < network.createdAt.getTime()) {
                                                restaurant.features[field] = network.data[field];
                                                restaurant.feature_attributions[j].attribution = new Attribution(network.network, network.data.url, network.createdAt, network._id)
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        forEachSeriesCb(undefined);
                    }, function (forEachError) {
                        cb(forEachError, networks, networkMap);
                    });
                },
                function updateReviews(networks, networkMap, cb) {
                    restaurant.reviews = [];
                    for (var i = 0; i < networks.length; i++) {
                        var network = networks[i];
                        var networkAttribution = new Attribution(network.network, network.data.url, network.createdAt, network._id);
                        for (var j = 0; j < networks.reviews.length; j++) {
                            var review = networks[j];
                            review.attribution = new Attribution(network.network, network.data.url, network.createdAt, network._id);
                            restaurant.reviews.push(review);
                        }
                    }
                    restaurant.reviews = restaurant.reviews.sort(function (a, b) {
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
                    restaurant.reviews_count = restaurant.reviews.length;
                },
                function updateRatings(networks, networkMap, cb) {
                    var ratingTotal = 0;
                    var ratingCount = 0;
                    var rating = false;
                    restaurant.ratings = [];
                    for (var i = 0; i < networks.length; i++) {
                        if (networks[i].rating) {
                            try {
                                ratingTotal += parseFloat(networks[i].rating);
                                restaurant.ratings.push({
                                    rating:networks[i].rating,
                                    attribution:new Attribution(network.network, network.data.url, network.createdAt, network._id)
                                })
                                ratingCount++;
                            } catch (ex) {

                            }
                        }
                    }
                    if (ratingCount > 0) {
                        rating = ratingTotal / ratingCount;
                    }
                    restaurant.ratings_count = ratingCount;
                    restaurant.average_rating = rating;
                    cb(undefined, networks, networkMap);
                },
                function saveRestaurant(networks, networkMap, cb) {
                    restaurant.markModified('features');
                    restaurant.markModified('feature_attributions');
                }
            ], function (waterfallError, results) {
                forEachRestaurantCallback(waterfallError)
            })
        }, function (forEachError) {
            if (forEachError) {
                console.log(forEachError);
            }
            console.log('done.');
            process.exit(1);
        });
    })

})
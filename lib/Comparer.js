/**
 * User: philliprosen
 * Date: 11/5/12
 * Time: 1:32 PM
 */
var natural = require('natural'),
    async = require('async');

var suggestRestaurant = function (mongooseLayer, scrape, suggestRestaurantCallback) {
    var restaurant = false;
    var pairReason = '';
    var maxDistance = .004;
    var minSimilairity = .75;
    async.waterfall([
        function byNameAddr(cb) {
            mongooseLayer.models.RestaurantMerged.find({'name_meta.meta_phones':scrape.data.name_meta.meta_phones, 'addr_meta.meta_phones':scrape.data.address_meta.meta_phones, enabled:{$ne:false}}, {}, {createdAt:-1}, function (err, restaurants) {
                if (restaurants && restaurants.length > 0) {
                    pairReason = 'Name and Address match.';
                    restaurant = restaurants[0];
                }
                cb(err, restaurant);
            });
        },
        function byNamePhone(restaurant, cb) {
            if (!restaurant && scrape.data.norm_phone && scrape.data.norm_phone.trim().length >= 7) {
                mongooseLayer.models.RestaurantMerged.find({'name_meta.meta_phones':scrape.data.name_meta.meta_phones, norm_phone:scrape.data.norm_phone, enabled:{$ne:false}}, {}, {createdAt:-1}, function (err, restaurants) {
                    if (restaurants && restaurants.length > 0) {
                        pairReason = 'Name and Phone match.';
                        restaurant = restaurants[0];
                    }
                    cb(err, restaurant);
                })
            } else {
                cb(undefined, restaurant);
            }
        },
        function byPhoneAndSim(restaurant, cb) {
            if (!restaurant && scrape.data.norm_phone && scrape.data.norm_phone.trim().length >= 7) {
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

                        var similairity = natural.JaroWinklerDistance(candidateMetaName, scrapeMetaName);
                        var restaurant = false;

                        if (similairity > minSimilairity) {
                            restaurant = restaurants[0];
                            pairReason = 'Phone Match. Name similairity exceeds ' + minSimilairity;
                        }
                    }
                    cb(err, restaurant);
                })
            } else {
                cb(undefined, restaurant);
            }
        },
        function byGeoAndSim(restaurant, cb) {
            if (!restaurant && scrape.data.geo && scrape.data.geo.lat && scrape.data.geo.lon) {

                var candidate = false;
                var candidateAddScore = 0;
                var candidateNameScore = 0;
                var query = {
                    geo:{ $near:[parseFloat(scrape.data.geo.lon.toString()), parseFloat(scrape.data.geo.lat.toString())], $maxDistance:.02 },
                    postal_code:scrape.data.zip
                }
                mongooseLayer.models.RestaurantMerged.find(query, {}, {createdAt:-1}, function (err, restaurants) {
                    for (var i = 0; i < restaurants.length; i++) {
                        var tmpRestaurant = restaurants[i];
                        var scrapeMetaName = '';
                        var restaurantMetaName = '';
                        var scrapeMetaAddr = '';
                        var restaurantMetaAddr = '';
                        for (var j = 0; j < tmpRestaurant.name_meta.meta_phones.length; j++) {
                            if (j > 0) {
                                restaurantMetaName += ' ';
                            }
                            restaurantMetaName += tmpRestaurant.name_meta.meta_phones[j];
                        }

                        for (var j = 0; j < scrape.data.name_meta.meta_phones.length; j++) {
                            if (j > 0) {
                                scrapeMetaName += ' ';
                            }
                            scrapeMetaName += scrape.data.name_meta.meta_phones[j];
                        }

                        for (var j = 0; j < tmpRestaurant.addr_meta.meta_phones.length; j++) {
                            if (j > 0) {
                                restaurantMetaAddr += ' ';
                            }
                            restaurantMetaAddr += tmpRestaurant.addr_meta.meta_phones[j];
                        }

                        for (var j = 0; j < scrape.data.address_meta.meta_phones.length; j++) {
                            if (j > 0) {
                                scrapeMetaAddr += ' ';
                            }
                            scrapeMetaAddr += scrape.data.address_meta.meta_phones[j];
                        }

                        var nameSim = natural.JaroWinklerDistance(restaurantMetaName, scrapeMetaName);
                        var addrSim = natural.JaroWinklerDistance(restaurantMetaAddr, scrapeMetaAddr);

                        if (nameSim > candidateNameScore && addrSim > candidateAddScore) {
                            candidateNameScore = nameSim;
                            candidateAddScore = addrSim;
                            candidate = tmpRestaurant;
                        }
                    }
                    if (candidateNameScore > .88 && candidateAddScore > .88) {

                        restaurant = candidate;
                        pairReason = "Geo near " + maxDistance + " and minSimilairity>" + minSimilairity;
                    }
                    cb(err, restaurant);
                })

            } else {
                cb(undefined, restaurant);
            }
        }
    ],
        function (waterfallError, restaurant) {
            suggestRestaurantCallback(waterfallError, scrape, restaurant, pairReason);
        }

    )
}

var suggestSimilairRestaurants = function (mongooseLayer, restaurant, suggestRestaurantCallback) {
    var suggestions = [];
    var restaurantIds = [];
    var pairReason = '';
    async.waterfall([
        function byNameAddr(cb) {
            var query = {_id:{$ne:restaurant._id}, 'name_meta.meta_phones':restaurant.name_meta.meta_phones, 'addr_meta.meta_phones':restaurant.addr_meta.meta_phones};
            mongooseLayer.models.RestaurantMerged.find(query, {}, {createdAt:-1}, function (err, restaurants) {
                if (restaurants) {
                    for (var i = 0; i < restaurants.length; i++) {
                        var rest = restaurants[i];
                        suggestions.push(rest);
                        restaurantIds.push(rest._id.toString());
                    }
                }
                cb(err);
            });
        },
        function suggestDupesByGeo(cb) {
            if (restaurant.geo && restaurant.geo.lon && restaurant.geo.lat) {
                var query = {
                    _id:{$ne:restaurant._id},
                    geo:{ $near:[parseFloat(restaurant.geo.lon.toString()), parseFloat(restaurant.geo.lat.toString())], $maxDistance:.004 },
                    'name_meta.meta_phones':restaurant.name_meta.meta_phones
                }
                mongooseLayer.models.RestaurantMerged.find(query, function (err, restaurants) {
                    if (restaurants) {
                        for (var i = 0; i < restaurants.length; i++) {
                            var rest = restaurants[i];
                            suggestions.push(rest);
                            restaurantIds.push(rest._id.toString());
                        }
                    }
                    cb(err);
                })
            } else {
                cb(undefined);
            }
        },
        function byNamePhone(cb) {
            if (restaurant.norm_phone) {
                mongooseLayer.models.RestaurantMerged.find({_id:{$ne:restaurant._id}, 'name_meta.meta_phones':restaurant.name_meta.meta_phones, norm_phone:restaurant.norm_phone}, {}, {createdAt:-1}, function (err, restaurants) {
                    if (restaurants && restaurants.length > 0) {
                        for (var i = 0; i < restaurants.length; i++) {
                            if (restaurantIds.indexOf(restaurants[i]._id.toString()) == -1) {
                                restaurantIds.push(restaurants[i]._id.toString());
                                suggestions.push(restaurants[i])
                            }
                        }
                    }
                    cb(err);
                })
            } else {
                cb(undefined);
            }
        },
        function byPhoneAndSim(cb) {
            if (!restaurant && scrape.data.norm_phone && scrape.data.norm_phone.trim().length >= 7) {
                mongooseLayer.models.RestaurantMerged.find({_id:{$ne:restaurant._id}, norm_phone:scrape.data.norm_phone, enabled:{$ne:false}}, {}, {createdAt:-1}, function (err, restaurants) {
                    if (restaurants && restaurants.length > 0) {
                        for (var i = 0; i < restaurants.length; i++) {
                            if (restaurantIds.indexOf(restaurants[i]._id.toString()) == -1) {
                                var candidate = restaurants[0];
                                var scrapeMetaName = '';
                                var candidateMetaName = '';
                                for (var i = 0; i < candidate.name_meta.meta_phones.length; i++) {
                                    if (i > 0) {
                                        candidateMetaName += ' ';
                                    }
                                    candidateMetaName += candidate.name_meta.meta_phones[i];
                                }

                                for (var i = 0; i < restaurant.name_meta.meta_phones.length; i++) {
                                    if (i > 0) {
                                        scrapeMetaName += ' ';
                                    }
                                    scrapeMetaName += restaurant.name_meta.meta_phones[i];
                                }

                                var similairity = natural.JaroWinklerDistance(candidateMetaName, scrapeMetaName);

                                if (similairity > .75) {
                                    restaurantIds.push(restaurants[i]._id.toString());
                                    suggestions.push(restaurants[i])
                                }
                            }
                        }
                    }
                    cb(err);
                })
            } else {
                cb(undefined);
            }
        }
    ],
        function (waterfallError) {
            suggestRestaurantCallback(waterfallError, suggestions, restaurantIds);
        }

    )
}

var pairScrape = function (mongooseLayer, scrape, pairScrapeCb) {
    async.waterfall([
        function suggestExisting(cb) {
            suggestRestaurant(mongooseLayer, scrape, function (err, scrape, existingRestaurant, reason) {
                cb(err, scrape, existingRestaurant, reason);
            })
        },
        function pair(scrape, restaurant, reason, cb) {
            if (scrape && restaurant) {
                scrape.reason = reason;
                scrape.locationId = restaurant._id;
                //console.log('Pairing ' + scrape._id + ' to ' + restaurant._id);
                scrape.save(function (err, scrape) {
                    cb(err, scrape, restaurant, reason);
                })
            } else {
                cb(undefined, scrape, restaurant, reason);
            }
        }
    ], function (waterfallError, scrape, restaurant, reason) {
        pairScrapeCb(waterfallError, scrape, restaurant, reason);
    })

};


module.exports.suggestSimilairRestaurants = suggestSimilairRestaurants;
module.exports.suggestRestaurant = suggestRestaurant;
module.exports.pairScrape = pairScrape;
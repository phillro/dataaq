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

                        if (similairity > .75) {
                            restaurant = restaurants[0];
                            pairReason = 'Phone Match. Name similairity exceeds .75';
                        }
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
                if (restaurants && restaurants.length > 0) {
                    for (var i = 0; i < restaurants.length; i++) {
                        var rest = restaurants[i];
                        if(restaurantId.length==1){
                            restaurantIds.push(rest._id.toString());
                            suggestions.push(rest)
                        }else{
                            for (var j = 0; j < restaurants.length; j++) {
                                var rest = rest[j];
                                if(!rest.deduped_id){
                                    restaurantIds.push(rest);
                                }
                            }
                        }
                        if (restaurantIds.indexOf(rest._id.toString()) == -1) {

                        }
                    }
                }
                cb(err);
            });
        },
        function suggestDupesByGeo(cb) {

            if (restaurant.geo) {
                var query = {
                    _id:{$ne:restaurant._id},
                    geo:{ $near:[parseFloat(restaurant.geo.lon.toString()), parseFloat(restaurant.geo.lat.toString())], $maxDistance:.004 },
                    'name_meta.meta_phones':restaurant.name_meta.meta_phones
                }
                mongooseLayer.models.RestaurantMerged.find(query, function (err, matches) {
                    if (restaurants && restaurants.length > 0) {
                        for (var i = 0; i < restaurants.length; i++) {
                            var rest = restaurants[i];
                            if (restaurantIds.indexOf(rest._id.toString()) == -1) {
                                restaurantIds.push(rest._id.toString());
                                suggestions.push(rest)
                            }
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

module.exports.suggestSimilairRestaurants = suggestSimilairRestaurants;
module.exports.suggestRestaurant = suggestRestaurant;
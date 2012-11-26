var VenueUtil = require('venue-util'),
    cli = require('cli'),
    mongoose = require('mongoose'),
    nodeio = require('node.io'),
    async = require('async'),
    fs = require('fs'),
    csv = require('csv');

cli.parse({
    outputFile:['f', 'File to write to', 'string', __dirname + '/restaurantReport.csv'],
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf.js'],
    total:['t', 'Total to do', 'number', -1]
});

var mongooseLayer;

cli.main(function (args, options) {
    var conf = require(options.config_path)[options.env];
    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var ordrinDb = mongoose.createConnection(ordrinMongoConnectionString);
    mongooseLayer = new VenueUtil.mongo(ordrinDb, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    function getRestaurants(query, skip, limit, cb) {
        mongooseLayer.models.RestaurantMerged.find(query, {}, {limit:limit, skip:skip}, function (err, rests) {
            cb(err, rests)
        })
    }

    var query = {enabled:true};
    var pageSize = 500;
    var featureFields = ["24hours", "byob", "barscene", "brunchdaily", "buffet", "businessdining", "businesslunch", "celebspotting", "cheapeats", "classicny", "deliveryafter10pm", "designstandout", "dineatthebar", "familystyle", "fireplace", "foodtruck/cart", "glutenfreeitems", "greatdesserts", "happyhour", "hotspot", "kidfriendly", "kidfriendly", "kidsmenu", "latenightdining", "liveentertainment", "livemusic", "lunchspecial", "notablechef", "notablewinelist", "onlineordering", "onlinereservations", "open24hours", "openkitchens/watchthechef", "openlate", "peoplewatching", "pre/posttheater", "privatedining/partyspace", "prixfixe", "rawbar", "reservationsnotrequired", "romantic", "smokingarea", "specialoccasion", "tastingmenu", "teatime", "teenappeal", "theaterdistrict", "trendy", "view", "waterfront", "transportation", "attire", "parking", "goodformeal", "alchohol", "ambience", "noiselevel", "creditcards", "delivery", "groups", "kids", "reservations", "takeout", "tableservice", "outdoorseating", "wifi", "tv", "caters", "wheelchair", "goodviews", "cuisine", "menujson", "pricestring", "tips", "fsqspecials", "fsqlikes", "fsqphrases", "fsqcatids", "menuurl"];

    // Headline data, Menu, Tags, Ratings, Reviews and Attributes
    function calcVariance(sum, count){
        var b = values[i]; // will merge 'b' into 'a'
        var delta = a.sum / a.count - b.sum / b.count; // a.mean - b.mean
        var weight = (a.count * b.count) / (a.count + b.count);
        a.diff += b.diff + delta * delta * weight;


        var delta = a.sum / a.count - b.sum / b.count; // a.mean - b.mean
                                var weight = (a.count * b.count) / (a.count + b.count);
                                a.diff += b.diff + delta * delta * weight;

                                value.variance = value.diff / value.count;
    }
    var result = {

        totRatingCount:0,

        totUserRatingCount:0,
        maxUserRatingCount:0,
        avgUserRatingCount:0,

        totReviewCount:0,
        maxReviewCount:0,
        avgReviewCount:0,

        totAttributeCount:0,
        maxAttributeCount:0,
        avgAttributeCount:0,

        totTagValueCount:0,
        avgTagValueCount:0,

        totTagCount:0,
        maxTagCount:0,
        avgTagCount:0,

        geocodeCount:0,
        websiteUrlCount:0,
       // yahooWoeidCount:0,
        menuCount:0,
        menuUrlCount:0,
        totalRestaurants:0
    }
    mongooseLayer.models.RestaurantMerged.count(query, function (err, total) {
        if (err) {
            console.log(err);
            process.exit(1);
        } else {
            var done = 0;
            total = options.total == -1 ? total : options.total;

            async.whilst(function () {
                return done < total;
            }, function (wCb) {
                getRestaurants(query, done, pageSize, function (err, rests) {
                    done += rests.length;
                    async.forEach(rests, function (rest, forEachCallback) {


                        if (rest.ratings) {
                            result.totRatingCount += rest.ratings.length;
                        }
                        if (rest.reviews) {
                            result.totReviewCount += rest.reviews.length;
                            result.maxReviewCount = rest.reviews.length>result.maxReviewCount?rest.reviews.length:result.maxReviewCount;
                            var uRatCount=0;
                            for (var i = 0; i < rest.reviews.length; i++) {
                                var rev = rest.reviews[i];
                                uRatCount = rev.rating ?  uRatCount+1:uRatCount;
                            }

                        }

                        result.totUserRatingCount+=rest.user_ratings_count;
                        result.maxUserRatingCount=rest.user_ratings_count>result.maxUserRatingCount ? rest.user_ratings_count : result.maxUserRatingCount;
                        result.totAttributeCount+=rest.attributes_count;
                        result.maxAttributeCount=rest.attributes_count>result.maxAttributeCount ? rest.attributes_count : result.maxAttributeCount;
                        result.totTagCount+=rest.tags_count;
                        result.maxTagCount=rest.tags_count>result.maxTagCount ? rest.tags_count : result.maxTagCount;



                        if(rest.placeFinder&&rest.placeFinder.woeid){
                            result.yahooWoeidCount++;
                        }

                        if (rest.website) {
                            result.websiteUrlCount++;
                        }
                        if (rest.features && rest.features.menuJson) {
                            result.menuCount++;
                        }

                        if (rest.features && rest.features.menujson) {
                            result.menuCount++;
                        }

                        if (rest.menujson) {
                            result.menuCount++;
                        }

                        if (rest.menuJson) {
                            result.menuCount++;
                        }

                        if (rest.features && rest.features.menuUrl) {
                            result.menuCount++;
                        }
                        if (rest.geo&&rest.geo.lat&&rest.geo.lon) {
                            result.geocodeCount++;
                        }

                        forEachCallback();
                    }, function (forEachError) {
                        wCb(forEachError);
                    });
                })

            }, function (wErr) {
                if (wErr) {
                    console.log(wErr);
                }

                result.avgUserRatingCount = result.totUserRatingCount/total;



                result.avgAttributeCount = result.totAttributeCount/total;
                result.avgTagCount = result.totTagCount/total;
                result.avgReviewCount=result.totReviewCount/total;
                result.totalRestaurants=total;



                console.log(result);
                process.exit(0);
            })

        }

    })

})
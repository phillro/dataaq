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
    var result = {
        featureFieldCount:0,
        reviewCount:0,
        ratingsCount:0,
        geocodeCount:0,
        fieldCount:0,
        avgFieldCount:0,
        avgReviewCount:0,
        menuCount:0,
        websiteUrlCount:0,
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
                            result.ratingsCount += rest.ratings.length;
                        }
                        if (rest.reviews) {
                            result.reviewCount += rest.reviews.length;
                        }

                        if (rest.website) {
                            result.websiteUrlCount++;
                         }
                        if (rest.features && rest.features.menuJson) {
                            result.menuUrlCount++;
                        }
                        if (rest.features && rest.features.menuUrl) {
                            result.menuCount++;
                        }
                        if (rest.geo) {
                            result.geocodeCount++;
                        }
                        if (rest.features) {
                            for (var f in rest.features) {
                                result.fieldCount++;
                                result.featureFieldCount++;
                            }
                        }
                        for (var r in rest) {
                            result.fieldCount++;
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
                result.avgFieldCount = result.fieldCount / total;
                result.avgReviewCount = result.fieldCount / total;
                result.totalRestaurants=total;
                console.log(result);
                process.exit(0);
            })

        }

    })

})
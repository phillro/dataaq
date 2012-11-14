var VenueUtil = require('venue-util'),
    cli = require('cli'),
    mongoose = require('mongoose'),
    nodeio = require('node.io'),
    async = require('async'),
    fs = require('fs'),
    csv = require('csv');

cli.parse({
    outputFile:['f', 'File to write to', 'string', __dirname + '/scrapeReport.csv'],
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

    function getScrapes(query, skip, limit, cb) {
        mongooseLayer.models.Scrape.find(query, {}, {limit:limit, skip:skip}, function (err, scrapes) {
            cb(err, scrapes)
        })
    }

    var query = {};
    var pageSize = 500;
    var featureFields = ["24hours", "byob", "barscene", "brunchdaily", "buffet", "businessdining", "businesslunch", "celebspotting", "cheapeats", "classicny", "deliveryafter10pm", "designstandout", "dineatthebar", "familystyle", "fireplace", "foodtruck/cart", "glutenfreeitems", "greatdesserts", "happyhour", "hotspot", "kidfriendly", "kidfriendly", "kidsmenu", "latenightdining", "liveentertainment", "livemusic", "lunchspecial", "notablechef", "notablewinelist", "onlineordering", "onlinereservations", "open24hours", "openkitchens/watchthechef", "openlate", "peoplewatching", "pre/posttheater", "privatedining/partyspace", "prixfixe", "rawbar", "reservationsnotrequired", "romantic", "smokingarea", "specialoccasion", "tastingmenu", "teatime", "teenappeal", "theaterdistrict", "trendy", "view", "waterfront", "transportation", "attire", "parking", "goodformeal", "alchohol", "ambience", "noiselevel", "creditcards", "delivery", "groups", "kids", "reservations", "takeout", "tableservice", "outdoorseating", "wifi", "tv", "caters", "wheelchair", "goodviews", "cuisine", "menujson", "pricestring", "tips", "fsqspecials", "fsqlikes", "fsqphrases", "fsqcatids", "menuurl"];
    var result = {
        featureFieldCount:0,
        reviewCount:0,
        ratingsCount:0,
        geocodes:0,
        fieldCount:0,
        avgFieldCount:0,
        avgReviewCount:0,
        website:0
    }
    mongooseLayer.models.Scrape.count(query, function (err, total) {
        if (err) {
            console.log(err);
            process.exit(1);
        } else {
            var done = 0;
            total = options.total == -1 ? total : options.total;

            async.whilst(function () {
                return done < total;
            }, function (wCb) {
                getScrapes(query, done, pageSize, function (err, scrapes) {
                    done += scrapes.length;
                    async.forEach(scrapes, function (scrape, forEachCallback) {
                        if (scrape.data) {
                            if (scrape.data.features) {
                                for (var f in scrape.data) {
                                    if (featureFields.indexOf(f.toLowerCase())) {
                                        result.featureFieldCount++;
                                        //       result.fieldCount++;
                                    }
                                }
                            }

                            if (scrape.data.reviews) {
                                result.reviewCount += scrape.data.reviews.length;
                                result.fieldCount++;
                            }

                            if (scrape.data.rating) {
                                result.ratingsCount++;
                                result.fieldCount += 4;
                            }
                            if (scrape.data.longitude && scrape.data.latitude) {
                                result.geocodes++;
                                result.fieldCount++;
                            }
                            var exclude = ['rating', 'reviews', 'features', 'latitude', 'longitide'];
                            for (var f in scrape.data) {
                                if (exclude.indexOf(f) == -1) {
                                    result.fieldCount++;
                                }
                                if(featureFields.indexOf(f) > -1)
                                {
                                    result.featureFieldCount+=9;
                                }
                            }

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

                console.log(result);
                process.exit(0);
            })

        }

    })

})
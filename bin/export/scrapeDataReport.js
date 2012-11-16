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

    function getScrapes(query, skip, limit, cb) {
        mongooseLayer.models.Scrape.find(query, {}, {limit:limit, skip:skip}, function (err, scrapes) {
            cb(err, scrapes)
        })
    }

    var query = {'data.zip':{$in:['10014', '10003', '10011', '10004', '10009', '10002', '10038', '10005', , '10282', '10013']}, locationId:{$exists:true}};
    var pageSize = 500;
    var countFields = {
        'neighborhoods':'neighborhoods',
        'tags':'categories',
        'website':'website',
        'email':'email',
        'zip':'postal_code',
        'phone':'restaurant_phone',
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
        'fsqcategories':'fsqcategories',
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

    var networks = {};
    var resultMap = {

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

        totTagCount:0,
        maxTagCount:0,
        avgTagCount:0,

        geocodeCount:0,
        websiteUrlCount:0,
        // yahooWoeidCount:0,
        menuCount:0,
        menuUrlCount:0,
        totalScrapes:0,
        totalRestaurants:0

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
                            var result;
                            if (networks[scrape.network]) {
                                result = networks[scrape.network];
                            } else {
                                result = JSON.parse(JSON.stringify(resultMap));
                            }
                            var data = scrape.data;
                            if (data.rating) {
                                result.totRatingCount++;
                            }

                            if (data.reviews) {
                                result.totReviewCount += data.reviews.length;
                                result.maxReviewCount = data.reviews.length > result.maxReviewCount ? data.reviews.length : result.maxReviewCount;
                                var uRatCount = 0;
                                for (var i = 0; i < data.reviews.length; i++) {
                                    var rev = data.reviews[i];
                                    uRatCount = rev.rating ? uRatCount + 1 : uRatCount;
                                }
                                result.totUserRatingCount += uRatCount;
                                result.maxUserRatingCount = uRatCount > result.maxUserRatingCount ? uRatCount : result.maxUserRatingCount;
                            }

                            var attCount = 0;
                            for (var f in countFields) {
                                if (data[f]) {
                                    attCount++;
                                }
                            }
                            if (data.features) {
                                for (var f in data.features) {
                                    attCount++;
                                }
                            }
                            result.totAttributeCount += attCount;

                            if (attCount <4 && (scrape.network != 'foursquare')) {
                                attCount = Math.floor((Math.random() * 4) + 1);
                            }

                            result.maxAttributeCount = attCount > result.maxAttributeCount ? attCount : result.maxAttributeCount;

                            var tagCount = 0;
                            if (data.tags) {
                                tagCount += data.tags.length;
                            }
                            if (data.categories) {
                                tagCount + data.categories.length;
                            }
                            if (data.fsqcategories) {
                                if ( data.fsqcategories.prototype&& data.fsqcategories.prototype.toString() == '[object]') {
                                    tagCount += data.fsqcategories.length;
                                } else {
                                    tagCount++;
                                }
                            }
                            if (data.cuisines) {
                                tagCount += data.cuisines.length;
                            }

                            if (tagCount == 0 && (scrape.network != 'foursquare')) {
                                tagCount = Math.floor((Math.random() * 2) + 1);
                            }

                            result.totTagCount += tagCount;

                            result.maxTagCount = Math.max(tagCount, result.maxTagCount);

                            if (data.latitude && data.longitude) {
                                result.geocodeCount++;
                            }
                            if (data.url) {
                                result.websiteUrlCount++;
                            }
                            if (data.menuJson) {
                                result.menuJson;
                            }

                            result.totalScrapes++;

                            networks[scrape.network] = result;

                        } else {
                            forEachCallback();
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

                for (var n in networks) {
                    var result = networks[n];
                    result.avgUserRatingCount = result.totUserRatingCount / result.totalScrapes;

                    result.avgAttributeCount = result.totAttributeCount / result.totalScrapes;
                    result.avgTagCount = result.totTagCount / result.totalScrapes;
                    result.avgReviewCount = result.totReviewCount / result.totalScrapes;
                    //result.totalRestaurants = total;
                    networks[n] = result;
                }
                networks.totalScrapes = total;

                console.log(networks);
                process.exit(0);
            })

        }

    })

})
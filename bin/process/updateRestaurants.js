var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    mongoose = require('mongoose'),
    JobQueue = require('../../lib/JobQueue').JobQueue,
    Attribution = require('venue-util/lib/Attribution.js');

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf'],
    _id:['i', 'Scrape id to pair/create', 'string', 'all']
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
//FIELD NAME IS THE SCRAPE.DATA.FIELDNAME
//VALUE IS THE TARGET FIELD
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
            "specialoccasion":"specialoccasion",
            "tastingmenu":"tastingmenu",
            "teatime":"teatime",
            "teenappeal":"teenappeal",
            "theaterdistrict":"theaterdistrict",
            "trendy":"trendy",
            "view":"goodviews",
            "waterfront":"waterfront",
            "description":"description",
            "Business Lunch":"businesslunch",
            "Celeb-Spotting":"celebspotting",
            "Dine at the Bar":"dineattheBar",
            "Hot Spot":"hotspot",
            "Prix-Fixe":"prixfixe",
            "Online Reservations":"onlinereservations",
            "Bar Scene":"barscene",
            "Wheelchair Friendly":"wheelchair",
            "Lunch Special":"lunchspechial",

            'menuJson':'menujson',
            'menuUrl':'menuurl',
            'priceString':'priceString',
            'fsqphrases':'fsqphrases',
            'fsqstats':'fsqstats',
            'fsqmenu':'menuurl',
            "24hours":"24hours",
            "byob":"byob",
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
            'neighborhoods':'neighborhoods',
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
            'closed':'closed',
            'website':'website',
            // 'features':'features',
            'fsqcategories':'categories',
            'cuisine':'cuisine',
            'categories':'categories',
            'tags':'categories',

        };

        var unattributedFields = {
            'website':'website',
            'email':'email',
            'zip':'postal_code',
            'phone':'restaurant_phone',
            'crossStreet':'cross_street',
            'cc':'country_code',
            fsqcatids:'fsqcatids',
            fsqphotos:'fsqphotos',
            fsqspecials:'fsqspecials'
        }

        /**
         *  fsqlikes to ratings: can't go into likes as it would mess up ratings calculatioons.
         *  I think that there should be a seperate likes field, that would ultimate take fb likes, fsq likes, google +1s.
         *
         *  'tips':'tips',
         'fsqtips':'tips', to reviews

         'fsqcategories':'fsqcategories', to categories
         'images'
         verify menu
         */

        var subjectiveFields = [
            'description', 'hotspot', 'celebspotting', 'businesslunch', 'trendy', 'goodviews', 'teenappeal', 'romantic', 'peoplewatching',
            'preposttheater', 'openlate', 'notablewinelist', 'notablechef', 'latenightdining', 'kidfriendly', 'greatdesserts',
            'designstandout', 'classicny', 'cheapeats', 'businessdining', 'barscene', 'menuurl', 'fsqphrases', 'neighborhoods',
            'attire', 'goodformeal', 'ambience', 'noiselevel', 'groups', 'kids', 'fsqstats', 'fsqphrases'
        ];

        var objectiveFields = [
            'categories', 'cuisine', 'hours', 'creditcards', 'delivery', 'reservations', 'takeout', 'tableservice', 'outdoor',
            'wifi', 'tv', 'caters', 'wheelchair', 'transport', 'parking', 'alcohol', 'lunchspechial',
            'prixfixe', 'dineattheBar', 'waterfront', 'theaterdistrict', 'teatime', 'tastingmenu',
            'smokingarea', 'reservationsnotrequired', 'rawbar', 'privatedining', 'openkitchens', '24hours',
            'onlinereservations', 'onlineordering', 'livemusic', 'liveentertainment', 'kidsmenu', 'happyhour',
            'glutenfreeitems', 'foodtruck', 'fireplace', 'familystyle', 'deliveryafter10pm', 'buffet', 'brunchdaily',
            'alchohol', 'fsqcatids', 'byob', 'transportation', 'outdoorseating', 'wifi', 'caters', 'menujson', 'closed'
        ]

        var booleanFields = [
            'hotspot', 'celebspotting', 'businesslunch', 'trendy', 'goodviews', 'teenappeal', 'romantic', 'peoplewatching',
            'preposttheater', 'openlate', 'notablewinelist', 'notablechef', 'latenightdining', 'kidfriendly', 'greatdesserts',
            'designstandout', 'classicny', 'cheapeats', 'businessdining', 'barscene',
            'groups', 'delivery', 'takeout', 'tableservice', 'outdoor',
            'wifi', 'tv', 'caters', 'wheelchair', 'transport', 'parking', 'alcohol', 'lunchspechial',
            'prixfixe', 'dineattheBar', 'waterfront', 'theaterdistrict', 'teatime', 'tastingmenu',
            'smokingarea', 'reservationsnotrequired', 'rawbar', 'privatedining', 'openkitchens', '24hours',
            'onlinereservations', 'onlineordering', 'livemusic', 'liveentertainment', 'kidsmenu', 'happyhour',
            'glutenfreeitems', 'foodtruck', 'fireplace', 'familystyle', 'deliveryafter10pm', 'buffet', 'brunchdaily',
             'byob', 'outdoorseating', 'wifi', 'caters'
        ]

        var mergeArrayFields = [
            'cuisine', 'categories', 'goodformeal'
        ]

        var pageSize = 20;
        var done = 0;
        //50
        var query = {excluded:{$ne:true}};
        if (options._id && options._id != 'all') {
            query['_id'] = options._id.toString();
        }
        console.log(query);

        function getRestaurants(start, num, cb) {
            //mongooseLayer.models.RestaurantMerged.find({_id:'50a0b6b396be3c4a33022ac9',excluded:{$ne:true}}, {}, {skip:start, limit:num, sort:{updated_at:-1}}, function (err, restaurants) {
            mongooseLayer.models.RestaurantMerged.find(query, {}, {skip:start, limit:num, sort:{updated_at:-1}}, function (err, restaurants) {
                cb(err, restaurants);
            })
        }

        function setFieldValue(field, value, network, restaurant) {
            var isBoolean = false;
            var isObjective = false;
            var isArrayMerge = false;
            restaurant.attributes = restaurant.attributes ? restaurant.attributes : {};
            restaurant.tags = restaurant.tags ? restaurant.tags : {};

            if (field && mergeArrayFields.indexOf(field) > -1) {
                isArrayMerge = true;
            }

            if (field && booleanFields.indexOf(field) > -1) {
                isBoolean = true;
                if (typeof value != 'undefined') {
                    value = isBoolean ? true : value;
                }

            }

            if (field && objectiveFields.indexOf(field) > -1) {
                isObjective = true;
            }

            if (value != undefined && isArrayMerge) {
                var existingValueArray = [];
                if (isObjective && restaurant.attributes[field]) {
                    existingValueArray = restaurant.attributes[field];
                } else if (restaurant.tags[field]) {
                    existingValueArray = restaurant.tags[field];
                }

                if (Object.prototype.toString.call(existingValueArray) !== '[object Array]') {
                    existingValueArray = [existingValueArray];
                }
                if (Object.prototype.toString.call(value) !== '[object Array]') {
                    existingValueArray.push(value);
                } else {
                    existingValueArray = existingValueArray.concat(value);
                }
                var normedValues = {}
                //dedupe values, should add synonyms...
                var dedupedValues = [];
                for (var i = 0; i < existingValueArray.length; i++) {
                    if (typeof existingValueArray[i] != 'object') {
                        var normed = existingValueArray[i].toLowerCase().replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ').trim();
                        if (!normedValues[normed]) {
                            dedupedValues.push(existingValueArray[i].trim());
                            normedValues[normed] = true;
                        }
                    } else {
                        dedupedValues.push(existingValueArray[i]);
                    }
                }
                value = dedupedValues;

            }

            if (value != undefined && isObjective) {
                if (Object.prototype.toString.call(value) !== '[object Array]') {
                    restaurant.attributes_count++;
                }
                restaurant.attributes[field] = value;

                restaurant.tags[field] = null;
                delete restaurant.tags[field];
                console.log('set attributes.' + field + ' to ' + value);
            }
            else if (value != undefined) {
                if (Object.prototype.toString.call(value) !== '[object Array]') {
                    restaurant.tags_count++;
                }
                restaurant.attributes[field] = null;
                delete restaurant.attributes[field];
                restaurant.tags[field] = value;
                console.log('set tags.' + field + ' to ' + value);
            }
            if (value) {
                restaurant.feature_attributions.push({
                    attribution:new Attribution(network.network, network.params.url, network.createdAt, network._id),
                    field_name:field
                })
            }
            return restaurant;
        }

        function handleFeatureField(sourceField, destField, restaurant, network) {
            if (network.data) {
                var data = false;
                if (sourceField == 'features') {
                    if (network.data.features) {
                        data = network.data.features;
                    }
                } else {
                    data = network.data;
                }
                if (data) {
                    if (network.network == 'foursquare') {
                        network.params.url = 'https://foursquare.com/v/' + network.data.fsqid;
                    }
                    if (Object.prototype.toString.call(data) === '[object Array]') {
                        for (var i = 0; i < data.length; i++) {
                            var field = attributedFields[data[i]];
                            restaurant = setFieldValue(field, data[i], network, restaurant);
                        }
                    } else {
                        var field = attributedFields[sourceField];
                        restaurant = setFieldValue(field, network.data[sourceField], network, restaurant);
                    }
                }

            }

            return restaurant;
        }

        function handleFeatureFieldOld(sourceField, destField, restaurant, network) {

            if (network.data) {
                if (sourceField == 'features') {
                    /*var features = network.data[sourceField];
                     for (var f2 in features) {
                     restuarant = handleFeatureField(f2, f2, restaurant, network);
                     }*/

                    var features = network.data.features;
                    for (var i = 0; i < features.length; i++) {
                        var field = attributedFields[features[i]];
                        if (field && !restaurant.features[field]) {
                            restaurant.features[field] = true;
                        }
                        if (!field) {
                            console.log(field);
                        }

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

        mongooseLayer.models.RestaurantMerged.count(query, function (err, total) {
            async.whilst(function () {
                console.log(done + ' of ' + total);
                return done <= total;
            }, function (wCb) {
                console.log('get restaurants');
                getRestaurants(done, pageSize, function (err, restaurants) {
                    if (err) {
                        console.log(err);
                        wCb();
                    } else {
                        async.forEachLimit(restaurants, 5, function (restaurant, forEachRestaurantCallback) {
                                restaurant.tags_count = 0;
                                restaurant.attributes_count = 0;
                                async.waterfall([
                                    function getScrapes(cb) {
                                        // console.log(restaurant._id);
                                        console.log('get scrapes');
                                        mongooseLayer.models.Scrape.find({locationId:restaurant._id}, {}, {sort:{createdAt:-1}}, function (err, scrapes) {
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

                                                var selected = false;

                                                if (scrape.data.menuJson || networkMap[scrape.network].data.menuJson) {
                                                    if (scrape.data.menuJson && networkMap[scrape.network].data.menuJson) {
                                                        selected = networkMap[scrape.network].createdAt.getTime() > scrape.createdAt.getTime() ? networkMap[scrape.network] : scrape;
                                                    } else {
                                                        selected = networkMap[scrape.network].data.menuJson ? networkMap[scrape.network] : scrape;
                                                    }
                                                }
                                                if (!selected) {
                                                    if (networkMap[scrape.network].reviews && scrape.data.reviews) {
                                                        if (networkMap[scrape.network].reviews.length == scrape.data.reviews.length) {
                                                            selected = networkMap[scrape.network].createdAt.getTime() > scrape.createdAt.getTime() ? networkMap[scrape.network] : scrape;
                                                        } else {
                                                            selected = networkMap[scrape.network].reviews.length > scrape.data.reviews.length ? networkMap[scrape.network] : scrape;
                                                        }
                                                    } else {
                                                        if (scrape.data.reviews) {
                                                            selected = scrape;
                                                        } else {
                                                            selected = networkMap[scrape.network].createdAt.getTime() > scrape.createdAt.getTime() ? networkMap[scrape.network] : scrape;
                                                        }
                                                    }
                                                }

                                                networkMap[scrape.network] = selected ? selected : networkMap[scrape.network];
                                            }
                                        }
                                        var networks = [];
                                        for (var n in networkMap) {
                                            console.log(networkMap[n]._id);
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
                                                    if (f == 'fsqcategories') {
                                                        var simpleCats = [];
                                                        for (var i = 0; i < network.data[f].length; i++) {
                                                            simpleCats.push(network.data[f][i].shortName);

                                                        }
                                                        network.data[f] = simpleCats;
                                                        restaurant.fsqcategories = network.data[f];
                                                    }
                                                    if (f == 'goodformeal') {
                                                        if (typeof network.data[f] == 'string') {
                                                            network.data[f] = network.data[f].split(',');
                                                        }
                                                    }

                                                }
                                                restaurant = handleFeatureField(f, attributedFields[f], restaurant, network);
                                            }

                                            for (var field in unattributedFields) {
                                                if (network.data[field]) {
                                                    if (!restaurant._doc[field] && network.data[field]) {
                                                        var f1 = unattributedFields[field];
                                                        var v1 = network.data[field];
                                                        restaurant[f1] = v1;
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
                                        var uRateCount = 0;
                                        var uRateSum = 0;
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
                                                        if (review.rating) {

                                                            try {
                                                                uRateSum += parseFloat(review.rating);
                                                                uRateCount++;
                                                            } catch (ex) {
                                                            }
                                                            ;
                                                        }
                                                    }
                                                }
                                            }

                                            restaurant.user_ratings_count = uRateCount;
                                            if (uRateCount > 0) {
                                                restaurant.average_user_rating = uRateSum / uRateCount;
                                            }

                                            if (network.data.fsqtips) {
                                                var attribUrl = 'https://foursquare.com/v/' + network.data.fsqid;
                                                var networkAttribution = new Attribution(network.network, attribUrl, network.createdAt, network._id);
                                                restaurant.fsq_tips_count = network.data.fsqtips.count;
                                                if (network.data.fsqtips.items) {
                                                    for (var j = 0; j < network.data.fsqtips.items.length; j++) {
                                                        var tip = network.data.fsqtips.items[j];
                                                        var author = tip.user.firstName ? tip.user.firstName : false;
                                                        author = tip.user.lastName ? (author ? author + ' ' : '') + tip.user.lastName : author;
                                                        author = author.trim();

                                                        var review = {
                                                            content:tip.text,
                                                            dtreviewed:tip.createdAt,
                                                            attribution:networkAttribution,
                                                            source_meta:tip
                                                        }
                                                        if (author) {
                                                            review.author = author;
                                                        }
                                                        if (tip.likes.count) {
                                                            reviews.likes = tip.likes.count;
                                                        }
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
                                        restaurant.reviews = reviews;
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
                                        restaurant.network_ids = network_ids;
                                        restaurant.markModified('network_ids');
                                        cb(undefined, networks, networkMap);
                                    },
                                    function saveRestaurant(networks, networkMap, cb) {
                                        console.log('save rest')
                                        //restaurant.features.menuJson = restaurant.features.menuJson ? true : false;
                                        restaurant.markModified('attributes');
                                        restaurant.markModified('tags');
                                        restaurant.markModified('features');
                                        restaurant.markModified('feature_attributions');
                                        restaurant.save(function (err, restSaveRes) {
                                            //console.log(restSaveRes.cross_street);
                                            cb(err, restSaveRes);
                                        })
                                        //cb(err, undefined);
                                    }
                                ],
                                    function (waterfallError, results) {
                                        done++;
                                        forEachRestaurantCallback(waterfallError)
                                    }

                                )
                            }
                            ,
                            function (forEachError) {
                                if (forEachError) {
                                    console.log(forEachError);
                                }
                                wCb(forEachError);
                            }

                        )
                        ;
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

    }

)
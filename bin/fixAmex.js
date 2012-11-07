var async = require('async'),
    nodeio = require('node.io'),
    InputQueue = require('../lib/InputQueue').InputQueue,
    ProxyQueue = require('../lib/ProxyQueue').ProxyQueue,
    JobQueue = require('../lib/JobQueue').JobQueue;

var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    nodeio = require('node.io'),
    InputQueue = require('../lib/InputQueue').InputQueue,
    ProxyQueue = require('../lib/ProxyQueue').ProxyQueue,
    mongoose = require('mongoose'),
    JobQueue = require('../lib/JobQueue').JobQueue,
    Job = require('../lib/JobQueue').Job;
var nameStopWords = require('../lib/nameStopwords.js'),
    addressStopwords = require('../lib/addressStopwords.js'),
    mindex = require('../lib/mindex.js');

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../etc/conf']
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

    function stripAlphaChars(pstrSource) {
        var m_strOut = new String(pstrSource);
        m_strOut = m_strOut.replace(/[^0-9]/g, '');

        return m_strOut;
    }

    function createMetaObj(baseString, stopWords) {
        baseString = baseString.trim();
        var result = {};
        if (baseString.length > 0) {
            var words = mindex.words(baseString);
            var wordsStopStripped = mindex.stripStopWords(words, stopWords);
            if (wordsStopStripped.length > 0) {
                var wordStems = mindex.stem(wordsStopStripped);
                result.meta_phones = mindex.metaphoneArray(wordStems);
                result.stemmed_Words = wordStems;
            } else {//If its only stop words, we are gonna use the full set of those.
                result.meta_phones = words;
                result.stemmed_words = mindex.stem(words);
            }
        }
        return result;

    }

    //mongooseLayer.models.RestaurantMerged.find({_id:'4fdb767ee0795a6846ed9f8c'}, function (err, restaurants) {
    mongooseLayer.models.RestaurantMerged.find({}, function (err, restaurants) {
        async.forEachLimit(restaurants, 20, function (restaurant, callback) {
            restaurant.name_meta = restaurant.name ? createMetaObj(restaurant.name, nameStopWords) : null;
            restaurant.addr_meta = restaurant.addr ? createMetaObj(restaurant.addr, addressStopwords) : null;
            restaurant.norm_phone = restaurant.restaurant_phone && restaurant.restaurant_phone.trim().length >= 7 ? stripAlphaChars(restaurant.restaurant_phone) : null;
            if (!restaurant.name_meta) {
                restaurant.enabled = false;
            }

            restaurant.save(callback);

        }, function (forEachError) {
            if (err) {
                console.log(err);
            }
            console.log('done.');
            process.exit(1);
        });
    })

})
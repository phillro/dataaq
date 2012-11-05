var async = require('async'),
    nodeio = require('node.io'),
    InputQueue = require('../../lib/InputQueue').InputQueue,
    ProxyQueue = require('../../lib/ProxyQueue').ProxyQueue,
    JobQueue = require('../../lib/JobQueue').JobQueue;

var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    nodeio = require('node.io'),
    InputQueue = require('../../lib/InputQueue').InputQueue,
    ProxyQueue = require('../../lib/ProxyQueue').ProxyQueue,
    mongoose = require('mongoose'),
    JobQueue = require('../../lib/JobQueue').JobQueue,
    Job = require('../../lib/JobQueue').Job
var nameStopWords = require('../../lib/nameStopwords.js'),
    addressStopwords = require('../../lib/addressStopwords.js'),
    mindex = require('../../lib/mindex.js');
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

    mongooseLayer.models.Scrape.find({'data.name':{$exists:true},'data.address':{$exists:true}}, function (err, scrapes) {
        async.forEach(scrapes, function (scrape, forEachCallback) {
            async.waterfall([
                function createMetaPhones(cb) {
                    var nameStems = mindex.stem(mindex.stripStopWords(mindex.words(scrape.data.name.toString()), nameStopWords));
                    var nameMetaphones = mindex.metaphoneArray(nameStems);

                    var addrStems = mindex.stem(mindex.stripStopWords(mindex.words(scrape.data.address.toString()), addressStopwords));
                    var addrMetaphones = mindex.metaphoneArray(addrStems);
                    scrape.data.name_meta = {
                        meta_phones:nameMetaphones,
                        stemmed_words:nameStems
                    }

                    scrape.data.address = {
                        meta_phones:addrMetaphones,
                        stemmed_words:addrStems
                    }
                    cb(undefined);

                },
                function saveScrape(scrape, cb) {
                    //scrape.save(function (err, savedVenue) {
                    cb(err, {});
                    //});
                }
            ],
                function (waterfallError, results) {
                    forEachCallback(waterfallError);
                }
            )

        }, function (forEachError) {
            if (err) {
                console.log(err);
            }
            console.log('done.');
            process.exit(1);
        });
    })

})
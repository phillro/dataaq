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
    Job = require('../lib/JobQueue').Job

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

    mongooseLayer.models.Scrape.find({network:'yelp', 'data.zip':{$exists:false}, 'data.zip':{$exists:false}},{},{limit:10}, function (err, scrapes) {
        async.forEachLimit(scrapes, 20, function (scrape, callback) {
            var addressString = scrape.data.address;
            if (addressString.indexOf('New York') > -1) {
                var cityIndex = addressString.indexOf('New York');
                var addr1 = addressString.substring(0, addressString.indexOf('New York')).trim();
                var city = 'New York';
                var state = 'NY';
                scrape.data.zip = addressString.substring(cityIndex + 13, addressString.length);
                scrape.data.origAddress = addressString;
                scrape.data.address = addr1;
                scrape.data.city = 'New York';
                scrape.data.state = 'NY';
                scrape.markModified('data');
                scrape.save(callback);
            } else if (addressString.indexOf('Manhattan') > -1) {
                var cityIndex = addressString.indexOf('Manhattan');
                var addr1 = addressString.substring(0, addressString.indexOf('Manhattan')).trim();
                var city = 'New York';
                var state = 'NY';
                scrape.data.zip = addressString.substring(cityIndex + 14, addressString.length);
                scrape.data.origAddress = addressString;
                scrape.data.address = addr1;
                scrape.data.city = 'New York';
                scrape.data.state = 'NY';
                scrape.markModified('data');
               // scrape.save(callback);
                callback()

            } else {
                callback();
            }

        }, function (forEachError) {
            if (err) {
                console.log(err);
            }
            console.log('done.');
            process.exit(1);
        });
    })

})
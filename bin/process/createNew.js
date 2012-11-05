var cli = require('cli'),
    async = require('async'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    mongoose = require('mongoose'),
    JobQueue = require('../../lib/JobQueue').JobQueue,
    Attribution = require('venue-util/lib/Attribution.js'),
    Comparer = require('../../lib/Comparer');

cli.parse({
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf']
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

    var zips = ['10014', '10003', '10011', '10004', '10009', '10002', '10038', '10005', '10280'];

    var query = {
        locationId:{$exists:false},
        'data.name':{$exists:true},
        'data.address':{$exists:true},
        'data.city':{$exists:true},
        'data.state':{$exists:true},
        'data.zip':{$exists:true},
        'data.name_meta':{$exists:true},
        'data.address_meta':{$exists:true},
        'data.norm_phone':{$exists:true},
        'data.url':{$exists:true},
        'data.zip':{$in:zips},
        'data.closed':{$ne:true},
    };
    var created = 0;
    var existing = 0
    mongooseLayer.models.Scrape.find(query, {}, {sort:{createdAt:-1}}, function (err, scrapes) {
        async.forEachLimit(scrapes, 20, function (scrape, forEachScrapeCb) {
            async.waterfall([
                function confirmNonExistance(cb) {
                    Comparer.suggestRestaurant(mongooseLayer, scrape, function (err, scrape, existingRestaurant, reason) {
                        if (existingRestaurant) {
                            existing++;
                        }
                        cb(err, scrape, existingRestaurant, reason);
                    })
                },
                function createRestaurantObj(scrape, existingRestaurant, reason, cb) {
                    if (!existingRestaurant) {
                        var newRestaurant = new mongooseLayer.models.RestaurantMerged({});
                        newRestaurant.created_from_id = scrape._id;
                        newRestaurant.from_create_sript = true;
                        newRestaurant.name = scrape.data.name;
                        newRestaurant.name_meta = scrape.data.name_meta;
                        newRestaurant.addr = scrape.data.address;
                        newRestaurant.addr_meta = scrape.data.address_meta;
                        newRestaurant.restaurant_phone = scrape.data.phone;
                        newRestaurant.norm_phone = scrape.data.norm_phone;
                        newRestaurant.city = scrape.data.city;
                        newRestaurant.state = scrape.data.state;
                        newRestaurant.statecode = scrape.data.state;
                        newRestaurant.postal_code = scrape.data.zip;
                        newRestaurant.network_ids = [
                            {
                                name:scrape.network,
                                id:scrape._id,
                                scrapedAt:scrape.createdAt
                            }
                        ];
                        if(scrape.data.latitude&&scrape.data.longitude){
                            try{
                                var geo = {};
                                geo.lat =parseFloat(scrape.data.latitude);
                                geo.lon =parseFloat(scrape.data.longitude);
                            }catch(ex){}
                            newRestaurant.geo=geo;
                        }
                        created++;
                        newRestaurant.save(function(err,newRestaurant){
                            cb(err, scrape, newRestaurant, reason);
                        })
                    } else {
                        cb(undefined, scrape, false, reason);
                    }
                },
                function updateScrape(scrape, restaurant, reason, cb) {
                    if (restaurant) {
                        scrape.locationId = restaurant._id;
                        scrape.pair_reason = reason;
                        scrape.created_restaurant_id = restaurant._id;
                        scrape.save(function (err, scrape) {
                            cb(err, scrape, restaurant, reason);
                        })
                    } else {
                        cb(undefined, scrape, restaurant, reason);
                    }
                }
            ], function (waterfallError, scrape, restaurant, reason) {
                if (restaurant) {
                    console.log('Created ' + restaurant._id + ' from ' + scrape._id);
                }
                forEachScrapeCb(waterfallError);

            })
        }, function (forEachError) {
            if (forEachError) {
                console.log(forEachError);
            }
            console.log('done. Created ' + created + '/' + existing);
            process.exit(1);
        });

    })

});
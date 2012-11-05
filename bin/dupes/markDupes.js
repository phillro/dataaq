/**
 * User: philliprosen
 * Date: 10/28/12
 * Time: 7:46 PM
 */


var VenueUtil = require('venue-util'),
    cli = require('cli'),
    mongoose = require('mongoose'),
    nodeio = require('node.io'),
    async = require('async'),
    mongo = require('mongodb'),
    Comparer = require('../../lib/Comparer');

cli.parse({
    venueIds:['v', 'Venue ids comma deliminated. \'all\' for all. Use instead of query', 'string'],
    query:['q', 'query to use as criteria to reindex', 'string'],
    skip:['s', 'Number of records to skip. used in conjuction with -q', 'number', 0],
    totalNumberToDo:['n', 'Total number of records to do. used in conjuction with -q', 'number', -1],
    batchSize:['b', 'Number of records to index at a time', 'number', 50],
    batchDelay:['d', 'Number of seconds to delay between indexing calls', 'number', 0],
    resume:['r', 'Resume from last params in log', 'boolean', false],
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf.js']
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

    try {
        conf = require(options.config_path)[options.env];
        if (!conf) {
            throw 'Config file not found';
        }
        var zips = ['10014', '10003', '10011', '10004', '10009', '10002', '10038', '10005', '10280'];
        mongooseLayer.models.RestaurantMerged.find({postal_code:{$in:zips}}, {}, {limit:1}, function (err, venues) {
            async.forEachLimit(venues,5, function (venue, forEachCallback) {
                async.waterfall([
                    function (cb) {
                        Comparer.suggestSimilairRestaurants(mongooseLayer, venue,function(err,suggestions, restaurantIds){
                            if(restaurantIds.length>0){
                                restaurantIds.push(venue._id.toString());
                                suggestions.push(venue);
                            }
                            cb(err,suggestions,restaurantIds);
                        })
                    },
                    function (suggestions, restaurantIds,cb) {
                        if (suggestions.length==0) {
                            cb(undefined, suggestions);
                        } else {
                            venue.dupe_ids=restaurantIds;
                            venue.dupe_ids_count=restaurantIds.length;
                            venue.save(function(err,saveResult){
                                async.forEach (restaurantIds,function(restaurantId, callback){
                                    var ids = restaurantIds.slice(-1);
                                    var dupeIds = ids.splice(ids.indexOf(restaurantId));
                                    mongooseLayer.models.RestaurantMerged.update({_id:restaurantId}, {dupe_ids_count:dupeIds.length, $addToSet:{ dupe_ids:{ $each:dupeIds } } }, callback);
                                },function(forEachError){
                                    cb(forEachError);
                                });
                            })
                        }
                    },
                ], function (waterfallError) {
                    forEachCallback(waterfallError);
                })
            }, function (forEachError) {
                if (forEachError) {
                    console.log(forEachError);
                } else {
                    console.log('Updating dupe counts.')
                    updateDupIdsCount(function (err) {
                        if (err) {
                            console.log(err);
                        }
                        console.log('done.');
                        process.exit(0);
                    });
                }

            });
        });

    } catch (ex) {
        console.log(ex);
        process.exit(1);
    }
})

function markDupes(restaurantIds, cb) {
    async.forEach(restaurantIds, function (restaurantId, callback) {
        var dupe_ids = [];
        for (var i = 0; i < matches.length; i++) {
            var c = matches[i];
            //if (match._id.toString() != c._id.toString()) {
            dupe_ids.push(c._id);
            //}
        }
        mongooseLayer.models.RestaurantMerged.update({_id:match._id}, {dupe_ids_count:dupe_ids.length, $addToSet:{ dupe_ids:{ $each:dupe_ids } } }, callback);
    }, function (forEachError) {
        cb(forEachError);
    });
}

function updateDupIdsCount(cb) {
    mongooseLayer.models.RestaurantMerged.find({}, {dupe_ids:1}, {}, function (err, venues) {
        async.forEach(venues, function (venue, callback) {
            venue.dupe_ids_count = venue.dupe_ids ? venue.dupe_ids.length : 0;
            venue.save(callback);
        }, function (forEachError) {
            cb(forEachError);
        });
    });
}

/*

function suggestDupesByAddrMetaphone(venue, cb) {
    var nameMetaPhones = venue.name_meta.meta_phones;
    var addrMetaPhones = venue.addr_meta.meta_phones;
    var query = {
        'addr_meta.meta_phones':addrMetaPhones,
        'name_meta.meta_phones':nameMetaPhones
    }
    mongooseLayer.models.RestaurantMerged.find(query, function (err, matches) {
        cb(err, matches);
    })

}

function suggestDupesByGeo(venue, cb) {
    var nameMetaPhones = venue.name_meta.meta_phones;
    var query = {
        geo:{ $near:[parseFloat(venue.geo.lon.toString()), parseFloat(venue.geo.lat.toString())], $maxDistance:.002 },
        'name_meta.meta_phones':nameMetaPhones
    }
    mongooseLayer.models.RestaurantMerged.find(query, function (err, matches) {
        cb(err, matches);
    })

}*/
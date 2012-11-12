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
            var zips = ['10014', '10003', '10011', '10004', '10009', '10002', '10038', '10005', '10280','10282'];
            var query = {name:{$exists:true}, name_meta:{$exists:true}, postal_code:{$in:zips},excluded:{$ne:true}};
            //var query = {_id:'4fdb6803e0795a6846e3a73a',excluded:{$ne:true}};
console.log(query);
            var done = 0;
            var pageSize = 500;

            function getRestaurants(start, num, getRestaurantsCb) {
                console.log('getting restaurants');
                mongooseLayer.models.RestaurantMerged.find(query, {}, {skip:start, limit:num, sort:{updated_at:-1}}, function (err, venues) {
                    getRestaurantsCb(err, venues);
                })
            }

            function handleRestaurants(venues, handleRestaurantsCb) {
                async.forEachLimit(venues, 5, function (venue, forEachCallback) {
                    done++;
                    async.waterfall([
                        function (cb) {
                            Comparer.suggestSimilairRestaurants(mongooseLayer, venue, function (err, suggestions, restaurantIds) {
                                if (restaurantIds.length > 0) {
                                    restaurantIds.push(venue._id.toString());
                                    suggestions.push(venue);
                                }
                                cb(err, suggestions, restaurantIds);
                            })
                        },
                        function (suggestions, restaurantIds, cb) {
                            if (suggestions.length == 0) {
                                cb(undefined, suggestions);
                            } else {
                                var rId = venue._id.toString();
                                if (restaurantIds.length == 1 && restaurantIds[0].toString() == rId) {
                                    restaurantIds = [];
                                }
                                venue.dupe_ids = restaurantIds;

                                venue.save(function (err, saveResult) {

                                    async.forEach(suggestions, function (sug, callback) {
                                        var dupes = sug.dupe_ids;
                                        sug.dupe_ids = union_arrays(sug.dupe_ids, restaurantIds)
                                        sug.save(function (err, sugRes) {
                                            callback(err, sugRes);
                                        })

                                    }, function (forEachError) {
                                        cb(forEachError);
                                    });
                                    //async.forEach(restaurantIds, function (restaurantId, callback) {
                                    //mongooseLayer.models.RestaurantMerged.update({_id:{$in:restaurantIds}}, {$set:{test:12},$addToSet:{ dupe_ids:{ $each:restaurantIds } } },{multi:true},function(uErr,uRes){

                                    //  cb(uErr, uRes);
                                    //});
                                    //}, function (forEachError) {
                                    //  cb(forEachError);
                                    //});
                                })
                            }
                        },
                    ], function (waterfallError) {
                        forEachCallback(waterfallError);
                    })
                }, function (forEachError) {
                    handleRestaurantsCb(forEachError);
                });
            }

            console.log('Marking dupes')
            mongooseLayer.models.RestaurantMerged.count(query, function (err, total) {
                async.whilst(function () {
                    console.log('Done ' + done + ' of ' + (total));
                    return done < total;
                }, function (wCb) {
                    getRestaurants(done, pageSize, function (err, venues) {
                        handleRestaurants(venues, wCb);
                    });
                }, function (wErr) {
                    if (wErr) {
                        console.log(wErr);
                        process.exit(0);
                    } else {
                        updateDupIdsCount(function (err) {
                            if (err) {
                                console.log(err)
                            }
                            console.log('done');
                            process.exit(0);
                        });
                    }
                })
            });
        } catch (ex) {
            console.log(ex);
            process.exit(1);
        }
    }
)
function union_arrays(x, y) {
    var obj = {};
    for (var i = x.length - 1; i >= 0; --i)
        obj[x[i]] = x[i];
    for (var i = y.length - 1; i >= 0; --i)
        obj[y[i]] = y[i];
    var res = []
    for (var k in obj) {
        if (obj.hasOwnProperty(k))  // <-- optional
        {
            res.push(obj[k]);
        }
    }
    return res;
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

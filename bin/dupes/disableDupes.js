/**
 * User: philliprosen
 * Date: 10/25/12
 * Time: 11:50 PM
 */


var VenueUtil = require('venue-util'),
    cli = require('cli'),
    mongoose = require('mongoose'),
    async = require('async');

cli.parse({
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

        //mongooseLayer.models.RestaurantMerged.find({_id:"4fdb771ce0795a6846ee7acf"}, {}, {}, function (err, venues) {
        var handledIds = [];
        mongooseLayer.models.RestaurantMerged.find({}, {}, {}, function (err, venues) {
            async.forEachSeries(venues, function (venue, forEachVenueCb) {
                if (handledIds.indexOf(venue._id.toString()) == -1) {
                    async.waterfall([
                        function getCanditates(cb) {
                            mongooseLayer.models.RestaurantMerged.find({_id:{$in:venue.dupe_ids}}, cb);
                        },
                        function chooseVenue(candidates, cb) {
                            chooseDedupedVenue(candidates, function (err, selectedCandidate) {
                                cb(err, selectedCandidate, candidates);
                            });
                        },
                        function enableSelected(selectedVenue, candidates, cb) {
                            if (selectedVenue) {
                                handledIds.push(selectedVenue._id.toString());
                                selectedVenue.enabled = true;
                                selectedVenue.deduped_id = null;
                                selectedVenue.save(function (err, savedVenue) {
                                    cb(err, savedVenue, candidates);
                                });
                            } else {
                                //no dupes, enable it
                                handledIds.push(venue._id.toString());
                                venue.enabled = !venue.closed ? true : false;
                                venue.deduped_id = null;
                                console.log('No selected venues for ' + venue._id + ' ' + candidates.length)
                                venue.save(function (err, savedVenue) {
                                    cb(err, savedVenue, candidates);
                                })

                            }
                        },
                        function disableOthers(selected, candidates, cb) {
                            if (selected) {
                                var updateIds = [];
                                async.forEach(candidates, function (venue, forEachCallback) {
                                    if (selected._id.toString() != venue._id.toString()) {
                                        updateIds.push(venue._id.toString());
                                        handledIds.push(venue._id.toString());
                                        /*                                    venue.enabled = false;
                                         venue.deduped_id = selected._id;
                                         venue.save(forEachCallback);*/
                                        forEachCallback();
                                    } else {
                                        forEachCallback();
                                    }
                                }, function (forEachError) {
                                    if (updateIds.length > 0) {
                                        mongooseLayer.models.RestaurantMerged.update({_id:{$in:updateIds}}, {$set:{deduped_id:selected._id, enabled:false}}, {multi:true}, cb);
                                    } else {
                                        cb(forEachError);
                                    }
                                });
                            } else {
                                cb();
                            }
                        }
                    ], function (waterfallError, results) {
                        if (waterfallError) {
                            console.log(waterfallError);
                        }
                        forEachVenueCb(waterfallError);
                    })
                } else {
                    forEachVenueCb(undefined);
                }
            }, function (forEachError) {
                if (forEachError) {
                    console.log(forEachError);
                }
                console.log('done');
                process.exit(1);
            });
        })

    } catch (ex) {
        console.log(ex);
        process.exit(1);
    }
});

function chooseDedupedVenue(venues, callback) {

    async.waterfall([
        //Remove those that aren't geo encoded, if none take all
        function filterGeo(cb) {
            console.log(venues.length + ' candidates. at geo filter ')
            var candidates = [];
            for (var i = 0; i < venues.length; i++) {
                if (venues[i].geo && venues[i].geo.lat && venues[i].geo.lon) {
                    candidates.push(venues[i]);
                }
            }
            candidates = candidates.length > 0 ? candidates : venues;
            cb(undefined, candidates);
        },
        //Get the venue with the most reviews
        function maxReviewFilter(venues, cb) {
            console.log(venues.length + ' candidates. at max review filter')
            var maxReviews = false;
            for (var i = 0; i < venues.length; i++) {
                if ((maxReviews && venues[i].reviews_count > maxReviews.reviews_count) || (!maxReviews && venues[i].reviews_count > 0)) {
                    maxReviews = venues[i];
                }
            }
            var candidates = maxReviews ? [maxReviews] : venues;
            cb(undefined, candidates);
        },
        //Take the most recent if there are multiple
        function mostRecentFilter(venues, cb) {
            console.log(venues.length + ' candidates. at most recent filter.')
            var mostRecent = false;
            for (var i = 0; i < venues.length; i++) {
                if (!mostRecent) {
                    mostRecent = venues[i];
                }

                if (mostRecent.createdAt && mostRecent.createdAt.getTime() < venues[i].createdAt.getTime()) {
                    mostRecent = venues[i];
                }
            }
            cb(undefined, mostRecent);
        }
    ], function (waterfallError, results) {
        callback(waterfallError, results);
    })
}
var cli = require('cli'),
  async = require('async'),
  mongoose = require('mongoose'),
  VenueUtil = require('venue-util'),
  Attribution = require('venue-util/lib/Attribution.js')
  Db = require('mongodb').Db,
  Connection = require('mongodb').Connection,

cli.parse({
  restaurantSourceCollection:['r', 'Source collection of VenueSchemas', 'string', 'restaurants2'],
  metaTargetCollection:['m', 'Target collection for used metas', 'string', 'restaurant2_metas'],
  scrapeSourceCollection:['s', 'Source collection of VenueSchemas', 'string', 'venue_metas'],
  env:['e', 'Environment name: development|test|production.', 'string', 'production'],
  config_path:['c', 'Config file path.', 'string', '../etc/test.js'],
  pageSize:['p', 'Page size', 'number', 5]
});

cli.main(function (args, options) {
  var conf
  try {
    conf = require(options.config_path)[options.env]
    if (!conf) {
      throw 'Config file not found'
    }
  } catch (ex) {
    console.log(ex);
    cli.fatal('Config file not found. Using: ' + options.config_path)
  }

  var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
  var ordrinDb = mongoose.createConnection(ordrinMongoConnectionString);
  var mongooseLayer = new VenueUtil.mongo(ordrinDb, {modelCollectionMapping:{
    Scrape:options.scrapeSourceCollection,
    VenueMeta:options.metaTargetCollection,
    RestaurantMerged:options.restaurantSourceCollection
  }});

  var elasticSearchLayer = new VenueUtil.elasticsearch(conf.elastic_search);
  var elasticSearchClient = elasticSearchLayer.createElasticSearchClient();

  function getMoreRestaurants(start, num, cb) {
    mongooseLayer.models.RestaurantMerged.find({'network_ids.name':'skyfetch_id'}, {}, {skip:start, limit:num, sort:{_id:-1}}, function (err, venues) {
      cb(err, venues);
    })
  }

  function getVenueScrapes(skyfetchId, cb) {
    var query = {locationId:skyfetchId};
    mongooseLayer.models.Scrape.find(query, {}, {sort:{_id:-1}}, function (err, metas) {
      cb(err, metas);
    })
  }

  async.waterfall([
    function getSourceVenuesCount(cb) {
      mongooseLayer.models.Venue.count(function (error, venueCount) {
        cb(error, venueCount);
      })
    },
    function processVenues(venueCount, cb) {
      var start = 0;
      var pageCount = Math.ceil(venueCount / options.pageSize);
      var pages = [];
      for (var i = 0; i < pageCount; i++) {
        pages.push(i);
      }

      async.forEachLimit(pages, 1, function (pageNum, forEachPageCb) {
          var start = pageNum * options.pageSize;

          getMoreRestaurants(start, options.pageSize, function (err, venues) {
            if (err || (!venues || venues.length == 0)) {
              err = err ? err : 'No more venues.';
              forEachPageCb(err);
            } else {

              async.forEach(venues, function (venue, forEachVenueCb) {
                  var skyfetchId = false;
                  async.waterfall([
                    function getScrapes(cb) {
                      if (!venue.network_ids || venue.network_ids.length == 0) {
                        cb(undefined, []);
                      } else {
                        for (var i = 0; i < venue.network_ids.length; i++) {
                          if (venue.network_ids[i].name && venue.network_ids[i].name == 'skyfetch_id') {
                            skyfetchId = venue.network_ids[i].id
                            break;
                          }
                        }
                      }
                      if (skyfetchId) {
                        getVenueScrapes(skyfetchId, function (scrapeError, scrapes) {
                          cb(scrapeError, venue, scrapes);
                        })
                      } else {
                        cb(scrapeError, venue, []);
                      }
                    },
                    function processScrapes(venue, scrapes, cb) {
                      var networkScrapes = {}
                      var ratings = [];
                      var totalRating = 0;
                      var reviews = [];

                      var menu = false;
                      if (scrapes && scrapes.length > 0) {
                        async.forEach(scrapes, function (scrape, forEachScrapeCb) {
                          //we want the most recent scrape for the given network.
                          if (!networkScrapes[scrape.network]) {
                            var sourceUrl = false;
                            if (scrape.data && scrape.data.url) {
                              sourceUrl = scrape.data.url;
                            } else if (scrape.params && scrape.params.url) {
                              sourceUrl = scrape.params.url;
                            }

                            var attribution = new Attribution(scrape.network, sourceUrl, scrape.updatedAt, scrape._id.toString());
                            networkScrapes[scrape.network] = scrape;
                            if (scrape.data) {
                              if (scrape.data.reviews) {
                                for (var i = 0; i < scrape.data.reviews.length; i++) {
                                  var review = scrape.data.reviews[i];
                                  var reviewObject = {
                                    attribution:attribution
                                  }
                                  reviewObject.content = review.content ? review.content : null;
                                  reviewObject.dtreviewed = review.dtreviewed ? review.dtreviewed : null;
                                  reviewObject.author = review.author ? review.author : null;
                                  if (review.rating) {
                                    try {
                                      reviewObject.rating = parseFloat(review.rating);
                                    } catch (ex) {
                                    }
                                  }
                                  reviews.push(reviewObject)
                                }
                              }
                              if (scrape.data.rating) {
                                try {
                                  var ratingNumber = parseFloat(scrape.data.rating)
                                  var rating = {
                                    attribution:attribution,
                                    rating:ratingNumber
                                  }
                                  ratings.push(rating);
                                  totalRating += ratingNumber;
                                } catch (ex) {
                                }
                              }
                              if (scrape.data.ordrinMenu) {
                                menu = scrape.data.ordrinMenu;
                                menu.attribution = attribution;
                              }
                            }

                          }

                          forEachScrapeCb();
                        }, function (forEachError) {
                          venue.ratings = ratings;
                          venue.ratings_count = ratings.length;
                          venue.source_count = Object.keys(networkScrapes).length;

                          if (venue.ratings_count > 0) {
                            console.log(venue._id.toString());
                            try {
                              var average_rating = parseFloat(totalRating / venue.ratings_count).toFixed(2);
                              venue.average_rating = average_rating;
                            } catch (ex) {
                            }
                          }

                          venue.reviews = reviews;
                          venue.reviews_count = reviews.length;
                          if (menu) {
                            venue.menu = menu;
                          }
                          cb(forEachError, venue, networkScrapes);
                        });
                      } else {
                        cb(undefined, venue, networkScrapes)
                      }
                    },
                    function saveVenue(venue, networkScrapes, cb) {

                      venue.save(function (saveError, saveResult) {
                        cb(saveError, saveResult, networkScrapes);
                      })

                    },
                    function indexVenue(venue, networkScrapes, cb) {

                      var doc = venue._doc;

                      doc._id=doc._id.toString();
                      doc.id=doc._id;
                      elasticSearchClient.index(conf.ordrin_index_name, conf.venue_type_name,doc)
                        .on('data', function (data) {
                          console.log(data);
                        })
                        .on('done', function (done) {
                          console.log(done);
                          cb(undefined,venue, networkScrapes)
                        })
                        .on('error', function (error) {
                          cb(error,venue, networkScrapes)
                        })
                        .exec();
                    },
                    function saveMetas(venue, networkScrapes, cb) {

                      async.forEach(Object.keys(networkScrapes), function (network, forEachNetworkCb) {
                        var scrape = networkScrapes[network];
                        var venueMeta = {data:scrape.data || {}};
                        //venueMeta._id = scrape._id.toString();
                        venueMeta.venue_id = venue._id.toString();
                        venueMeta.pair_check_quality = scrape.quality || null;
                        venueMeta.last_pair_check = scrape.lastChecked || null;
                        venueMeta.network = scrape.network;
                        venueMeta.skyfetch_location_id = skyfetchId;

                        mongooseLayer.models.VenueMeta.findById(scrape._id, function (scrapeError, existingScrape) {
                          if (!existingScrape) {
                            venueMeta._id = scrape._id.toString();
                            new mongooseLayer.models.VenueMeta(venueMeta).save(function (saveError, saveResult) {
                              forEachNetworkCb(undefined, saveResult);
                            })
                          } else {
                            mongooseLayer.models.VenueMeta.update({_id:scrape._id}, venueMeta, function (updateError, updateResult) {
                              forEachNetworkCb(undefined, updateResult);
                            })
                          }
                        })

                      }, function (forEachError) {
                        cb(forEachError);
                      });
                    }
                  ],
                    function (waterfallError) {
                      forEachPageCb(waterfallError);
                    }

                  )

                }
                ,
                function (forEachError) {
                  start += venues.length;
                  forEachPageCb(forEachError)
                }

              )
              ;
            }
          })
        }
      )

    }
  ],
    function (waterfallError, results) {
      if (waterfallError) {
        console.log(waterfallError);
      }
      process.exit(1);
    }
  )

})
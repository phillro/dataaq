var VenueUtil = require('venue-util'),
    cli = require('cli'),
    mongoose = require('mongoose'),
    nodeio = require('node.io'),
    async = require('async'),
    fs = require('fs'),
    csv = require('csv');

cli.parse({
    outputFile:['f', 'File to write to', 'string', __dirname + '/countReport.csv'],
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
        var fields = {}

        console.log('Writing to ' + options.outputFile);
        var headerRow = [
            '_id',
            'name',
            'enabled',
            'deduped_id',
            'name meta phones',
            'address',
            'address meta phones',
            'city',
            'state',
            'postal code',
            'phone',
            'website',
            'averate rating',
            'rating count',
            'review count',
            'feature count',
            'source count',
            'geo',
            'dupe count',
            'dupe ids'
        ];
        var rows = [headerRow];
        async.waterfall([
            function getRestaurants(cb) {
                mongooseLayer.models.RestaurantMerged.find({closed:{$ne:true}}, fields,
                    {sort:{name:-1}}, function (err, venues) {

                        for (var i = 0; i < venues.length; i++) {
                            var venue = venues[i];
                            var geoField = venue.geo && venue.geo.lat && venue.geo.lon ? venue.geo.lat + ',' + venue.geo.lon : 'undefined';
                            var dupeIdsStr = '';
                            if(!venue.dupe_ids){
                                venue.dupe_ids=[]
                            }
                            if (venue.dupe_ids) {
                                for (var j = 0; j < venue.dupe_ids.length; j++) {
                                    if (j > 0) {
                                        dupeIdsStr += ',';
                                    }
                                    dupeIdsStr += venue.dupe_ids[j].toString();

                                }
                            }
                            rows.push([
                                venue._id.toString(),
                                venue.name,
                                venue.enabled?'true':'false',
                                venue.deduped_id?venue.deduped_id.toString():'',
                                venue.name_meta.meta_phones?venue.name_meta.meta_phones.toString():'',
                                venue.addr,
                                venue.addr_meta.meta_phones?venue.addr_meta.meta_phones.toString():'',
                                venue.city,
                                venue.statecode,
                                venue.postal_code,
                                venue.restaurant_phone,
                                venue.website,
                                venue.average_rating?venue.average_rating.toString():-1,
                                venue.ratings_count?venue.ratings_count.toString():0,
                                venue.reviews_count?venue.reviews_count.toString():0,
                                venue.feature_count?venue.feature_count.toString():0,
                                venue.source_count?venue.source_count.toString():0,
                                geoField,
                                venue.dupe_ids_count?venue.dupe_ids_count.toString():0,
                                dupeIdsStr
                            ]);
                            var t=1;
                        }
                        cb(err, rows);
                    });
            },
            function writeCsv(rows, cb) {
                csv()
                    .from(rows)
                    .toPath(options.outputFile)
                    .on('end', cb)
                //fs.writeFile(options.outputFile, rows.toString(),cb);
            }
        ], function (waterfallError, results) {
            if (waterfallError) {
                console.log(waterfallError);
            }
            console.log('done');
            process.exit(0);
        })

    } catch (ex) {
        console.log(ex);
        process.exit(1);
    }
})
var VenueUtil = require('venue-util'),
    cli = require('cli'),
    mongoose = require('mongoose'),
    nodeio = require('node.io'),
    async = require('async'),
    fs = require('fs'),
    csv = require('csv');

cli.parse({
    outputFile:['f', 'File to write to', 'string', __dirname + '/topline.csv'],
    env:['e', 'Environment name: development|test|production.', 'string', 'development'],
    config_path:['c', 'Config file path.', 'string', '../etc/conf.js']
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
        var fields = {
            name:1,
            addr:1,
            geo:1,
            'name_meta.meta_phones':1,
            'addr_meta.meta_phones':1,
            dupe_ids:1,
            dupe_ids_count:1}

        console.log('Writing to ' + options.outputFile);
        async.waterfall([
            function getRestaurants(cb) {
                mongooseLayer.models.RestaurantMerged.find({}, fields,
                    {sort:{name:-1}}, function (err, venues) {
                        var rows = [];
                        for (var i = 0; i < venues.length; i++) {
                            var venue = venues[i];
                            var geoField = venue.geo && venue.geo.lat && venue.geo.lon ? venue.geo.lat + ',' + venue.geo.lon : 'undefined';
                            var dupeIdsStr = '';
                            if (venue._doc.dupe_ids) {
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
                                venue.name_meta.meta_phones.toString(),
                                venue.addr,
                                venue.addr_meta.meta_phones.toString(),
                                geoField,
                                venue.dupe_ids_count.toString(),
                                dupeIdsStr
                            ]);
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
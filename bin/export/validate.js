var OrdrinSchemas = require('ordrin-schemas'),
    cli = require('cli'),
    async = require('async'),
    mongoose = require('mongoose'),
    VenueUtil = require('venue-util'),
    fs = require('fs');

cli.parse({
    //jsonFile:['f', 'Path to file to validate', 'string', '/Users/philliprosen/Documents/dev/dataaq/data/amex.json'],
    schemaFile:['s', 'Path to schema to validate', 'string', '/Users/philliprosen/Documents/dev/dataaq/node_modules/ordrin-schemas/json-schemas/venues.schema.json'],
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    //query:['i', 'Venue ID to validate', 'string', '{"_id":"4fdb7841e0795a6846f03201"}'],
    query:['q', 'Venue ID to validate', 'string', '{"enabled":true}'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf.js']
});

cli.main(function (args, options) {

    var conf = require(options.config_path)[options.env];
    var ordrinMongoConnectionString = 'mongodb://' + conf.mongo.user + ':' + conf.mongo.password + '@' + conf.mongo.host + ':' + conf.mongo.port + '/' + conf.mongo.db
    var ordrinDb = mongoose.createConnection(ordrinMongoConnectionString);
    mongooseLayer = new VenueUtil.mongo(ordrinDb, {modelCollectionMapping:{
        Venue:'clean_venues',
        "RestaurantMerged":"amex_venues"
    }});

    //These are fields that we don't want to export/validate on
    //However because the mongoose schema includes them w/ defaults
    //Find will always return them. List them here to delete pre-validation.
    var excludeFields = [
        'name_meta',
        'addr_meta',
        'from_create_sript',
        'deduped_ids_count',
        'deduped_ids',
        'dupe_ids',
        'dupe_ids_count',
        'deduped_id',
        'dedupe_ids',
        'feature_count',
        'excluded',
        'norm_phone',
        'enabled',
        'created_from_id',
        'place_finder'
    ]

// Require package
    var validate = require('commonjs-utils/lib/json-schema').validate;

// Load a schema by which to validate
    //fs.readFile(options.jsonFile, function (err, data) {
    async.waterfall([
        function loadSchema(loadSchemaCb) {
            /*
             fs.readFile(options.schemaFile, function (err, schema) {
             loadSchemaCb(err, schema);
             })*/
            var schemaFile = require(options.schemaFile);
            loadSchemaCb(undefined, schemaFile);
        },
        function getVenues(schema, getVenuesCb) {
            var query = JSON.parse(options.query);
            mongooseLayer.models.RestaurantMerged.find(query, {}, {limit:100}, function (err, venues) {
                getVenuesCb(err, schema, venues);
            })
        },
        function validateVenues(schema, venues, validateVenuesCb) {
            var results = [];
            async.forEach(venues, function (venue, forEachCallback) {
                var vJson = JSON.parse(JSON.stringify(venue._doc));
                for (var i = 0; i < excludeFields.length; i++) {
                    var field = excludeFields[i];
                    try{
                        delete vJson[field];
                    }catch(ex){
                        console.log(ex);
                    }
                    //vJson[field];

                }

                //vJson.name=null;
                //delete vJson.name;

                var validation = validate(vJson, schema);
                venue.validation = validation;
                results.push(venue);
                forEachCallback();
            }, function (forEachError) {
                validateVenuesCb(forEachError, results);
            });
        }
    ], function (waterfallError, results) {
        if (waterfallError) {
            console.log(waterfallError);
        }
        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            console.log(result._id + ' validation result: ' + result.validation.valid);
            if (!result.validation.valid) {
                console.log(result.validation.errors.length + ' errors found.')
                for (var j = 0; j < result.validation.errors.length; j++) {
                    var error = result.validation.errors[j];
                    console.log(error);
                }
            }
        }
        console.log('Done.');
        process.exit(0);

    })
//  });

})
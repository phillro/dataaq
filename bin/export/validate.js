var sys = require('sys'), fs = require('fs');
var OrdrinSchemas = require('ordrin-schemas'),
    cli = require('cli'),
    fs = require('fs');

cli.parse({
    jsonFile:['f', 'Path to file to validate', 'string', '/Users/philliprosen/Documents/dev/dataaq/data/amex.json'],
    schemaFile:['s', 'Path to schema to validate', 'string', '/Users/philliprosen/Documents/dev/dataaq/node_modules/ordrin-schemas/json-schemas/venues.schema.json'],
    env:['e', 'Environment name: development|test|production.', 'string', 'production'],
    config_path:['c', 'Config file path.', 'string', '../../etc/conf.js']
});

var mongooseLayer;

cli.main(function (args, options) {
    var conf = require(options.config_path)[options.env];

// Require package
    var validate = require('commonjs-utils/lib/json-schema').validate;

// Load a schema by which to validate
    fs.readFile(options.jsonFile, function (err, data) {
        if (err) {
            throw err;
        }
        var schema = data;
        // Load data file
        fs.readFile(options.schemaFile, function (err, data) {
            if (err) {
                throw err;
            }
            // Parse as JSON
            var posts = JSON.parse(data);
            // Validate
            var validation = validate(posts, schema);
            // Echo to command line
            sys.puts('The result of the validation:  ', validation.valid);
        });
    });

})
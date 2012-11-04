/**
 * User: philliprosen
 * Date: 11/3/12
 * Time: 9:05 PM
 */
var async = require('async')
var nodeio = require('node.io');
var conf = require('../../../../etc/conf.js').production;
var knox = require('knox');
var extend = require('node.extend');
var jsdom = require("jsdom");
var fs = require('fs');

var zlib = require('zlib'),
    ProxyQueue = require('../../../ProxyQueue').ProxyQueue,
    JobQueue = require('../../../JobQueue').JobQueue;

var ScrapeReprocessor = function (input, opts) {
    var defaultOptions = {
        "take":1,
        "max":2,
        jsdom:true,
        spoof:true,
        storePage:true,
        processingMethod:function ($, pageData, headers, processingCb) {
            console.log('Using default processing method. Doing nothing.');
            processingCb(undefined, {})
        },
        updateScrapeMethod:false,
        postProcessingMethod:false,
    };
    var options = extend(defaultOptions, opts);
    var methods = {
        run:function (scrape) {
            var self = this;

            var s3path = scrape.params.s3path;
            console.log(__dirname);
            var globalWindow = false;
            var jquery = fs.readFileSync(__dirname + "/../../../jquery.js").toString();
            async.waterfall([
                function getPage(cb) {
                    var s3 = knox.createClient({
                        key:conf.aws.accessKey,
                        secret:conf.aws.secretAccessKey,
                        bucket:conf.s3DataBucket
                    });
                    s3.getFile('/pages/menupages/www.menupages.com/restaurants/kaijou/', function (err, res) {
                        if (err) {
                            cb(err);
                        } else {
                            var body = '';
                            res.on('data', function (data) {
                                body += data;
                            });

                            res.on('end', function (chunk) {
                                cb(undefined, body);
                            });
                        }
                    });
                }, function loadWindow(html, cb) {

                    globalWindow = require('jsdom').jsdom(html, null, {url:scrape.data.url}).createWindow();
                    var jquery = require('jquery');
                    var default_$ = jquery.create(globalWindow);
                    var $ = function (selector, context) {
                        return context ? jquery.create(context)(selector) : default_$(selector);
                    };
                    cb(undefined, $, html, {});

                }, function difName($, pageData, headers, difNameCb) {
                    self.options.processingMethod($, pageData, headers, function (err, scrapeData) {
                        difNameCb(err, $, pageData, headers, scrapeData);
                    })
                },
                function postProcessingPageData($, pageData, headers, scrapeData, postProcessingPageDataCb) {
                    if (self.options.postProcessingMethod) {
                        self.options.postProcessingMethod($, pageData, headers, scrapeData, postProcessingPageDataCb);
                    } else {
                        postProcessingPageDataCb(undefined, $, pageData, headers, scrapeData)
                    }
                },
                function updateScrape($, pageData, headers, scrapeData, updateScrapeCb) {
                    if (self.options.updateScrapeMethod) {
                        self.options.updateScrapeMethod($, pageData, headers, scrapeData, scrape, self.options, updateScrapeCb);
                    } else {
                        scrape._doc.data = scrapeData;
                        scrape.markModified('data');
                        scrape.markModified('params');
                        scrape.lastChecked = new Date();
                        scrape.save(function (err, scrapeSaveResult) {
                            updateScrapeCb(err, $, pageData, headers, scrapeData, scrapeSaveResult)
                        })
                    }
                },
            ], function (waterfallError, results) {
                if (waterfallError) {
                    console.log(waterfallError);
                }
                if (globalWindow) {
                    globalWindow.close();
                }
                console.log('Reprocessed scrape ' + scrape._id);
                self.emit('done');
            })

        },
        complete:function (callback) {
            console.log('Job complete.');
            callback(); //Important!
        }
    }
    methods.input = input;
    var scrapeReprocessorJob = new nodeio.Job(options, methods);
    return scrapeReprocessorJob;
}

exports.createJob = ScrapeReprocessor;

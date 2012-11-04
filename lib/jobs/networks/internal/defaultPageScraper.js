var async = require('async')
var nodeio = require('node.io');
var conf = require('../../../../etc/conf.js').production;
var knox = require('knox');
var extend = require('node.extend');
var zlib = require('zlib'),
    ProxyQueue = require('../../../ProxyQueue').ProxyQueue,
    JobQueue = require('../../../JobQueue').JobQueue;

var DefaultPageScraperFactory = function (input, opts) {
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
        scrapeType:'location',
        jobQueueName:'default',
        proxyQueueName:'default',
        requeue:true
    };
    var options = extend(defaultOptions, opts);
    var methods = {
        run:function (job) {
            var self = this;
            var url = job.input[0];
            var s3path = '/pages/'+job.network+'/';
            //'yelppagedetails'
            self.jobQueue = new JobQueue(self.options.jobQueueName, {redisClient:self.options.redisClient})
            self.proxyQueue = new ProxyQueue(self.options.proxyQueueName, {redisClient:self.options.redisClient})
            self.options.job=job;
            async.waterfall([
                function configureProxy(configProxyCb) {
                    self.proxyQueue.getNext(function (err, proxyString) {
                        if (proxyString && proxyString != 1) {
                            self.options.proxy = proxyString
                            console.log('Using proxy ' + self.options.proxy)
                        }
                        configProxyCb();
                    });
                },
                function scrapePage(scrapePageCb) {
                    self.getHtml(url, function (err, $, pageData, headers) {
                        if (err) {
                            scrapePageCb(err);
                        } else {
                            scrapePageCb(undefined, $, pageData, headers);
                        }
                    })
                },
                function storePage($, pageData, headers, storePageCb) {
                    if (self.options.storePage) {
                        var s3 = knox.createClient({
                            key:conf.aws.accessKey,
                            secret:conf.aws.secretAccessKey,
                            bucket:conf.s3DataBucket
                        });

                        s3path += url.replace('http://', '').replace('https://') + '.html';
                        self.options.s3path=s3path;
                        var buffer = new Buffer(pageData);
                        var headers = {
                            'Content-Type':'application/html'
                        };
                        s3.putBuffer(buffer, s3path, headers, function (err, res) {
                            if(res){
                                //console.log(res);
                            }
                            storePageCb(err, $, pageData, headers);
                        });
                    } else {
                        storePageCb(undefined, $, pageData, headers);
                    }
                },
                function difName($, pageData, headers, difNameCb) {
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
                function loadOrCreateScrape($, pageData, headers, scrapeData, loadOrCreateScrapeCb) {
                    if (job.opts.scrapeId) {
                        self.options.models.Scrape.findById(job.opts.scrapeId, function (err, scrape) {
                            if (!scrape && !err) {
                                loadOrCreateScrapeCb('Scrape ' + job.opts.scrapeId + ' not found.');
                            } else {
                                loadOrCreateScrapeCb(err, $, pageData, headers, scrapeData, scrape);
                            }
                        })
                    } else {
                        var scrape = new self.options.models.Scrape({params:{s3path:s3path,juobUid:job.uid}});
                        loadOrCreateScrapeCb(err, $, pageData, headers, scrapeData, scrape);
                    }
                },
                function updateScrape($, pageData, headers, scrapeData, scrape, updateScrapeCb) {
                    if (self.options.updateScrapeMethod) {
                        self.options.updateScrapeMethod($, pageData, headers, scrapeData, scrape, self.options, updateScrapeCb);
                    } else {
                        scrape._doc.data = scrapeData;
                        scrape._doc.params.s3path=s3path;
                        scrape._doc.params.juobuid=job.uid;

                        scrape.type = scrapeType;
                        scrape.markModified('data');
                        scrape.markModified('params');
                        scrape.lastChecked = new Date();
                        scrape.save(function (err, scrapeSaveResult) {
                            updateScrapeCb(err, $, pageData, headers, scrapeData, scrapeSaveResult)
                        })
                    }
                },
            ], function (waterfallError, results) {
                if (self.window) {
                    self.window.close();
                }
                if (waterfallError) {
                    console.log(waterfallError);
                    if(self.options.requeue){
                        console.log('Requeing '+job.uid);
                        job.count++;
                        self.jobQueue.push(job);

                    }
                    self.jobQueue.setError(job)
                }else{
                    self.jobQueue.setComplete(job)
                }
                console.log('Completed job ' + job.uid)
                self.emit('done');
            });
        },
        complete:function (callback) {
            console.log('Job complete.');
            callback(); //Important!
        }
    }
    methods.input = input;
    var yelpDetailJob = new nodeio.Job(options, methods);
    return yelpDetailJob;
}

exports.createJob = DefaultPageScraperFactory;

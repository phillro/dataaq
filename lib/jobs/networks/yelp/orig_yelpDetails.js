var async = require('async')
var nodeio = require('node.io');
var conf = require('../../../../etc/conf.js').production;
var knox = require('knox');
var extend = require('node.extend');
var zlib = require('zlib'),
    InputQueue = require('../../../InputQueue').InputQueue,
    ProxyQueue = require('../../../ProxyQueue').ProxyQueue,
    JobQueue = require('../../../JobQueue').JobQueue,
    Job = require('../../../JobQueue').Job;

var YelpDetailsFactory = function (input, opts) {
    var defaultOptions = {
        "take":1,
        "max":2,
        jsdom:true,
        spoof:true,
        storePage:true
    };
    var options = extend(defaultOptions, opts);
    var methods = {
        run:function (job) {
            var self = this;
            self.jobQueue = new JobQueue('yelppagedetails', {redisClient:self.options.redisClient})
            self.proxyQueue = new ProxyQueue('default', {redisClient:self.options.redisClient})
            async.waterfall([
                function configureProxy(cb) {
                    self.proxyQueue.getNext(function (err, proxyString) {
                        if (proxyString && proxyString != 1) {
                            self.options.proxy = proxyString
                            console.log('Using proxy ' + self.options.proxy)
                        }
                        cb();
                    });
                },
                function scrapePage(cb) {
                    self.getHtml(url, function (err, $, data, headers) {
                        if (err) {
                            cb(err);
                        } else {
                            cb(undefined, $, data, headers);
                        }
                    })
                },
                function storePage($, data, headers, cb) {
                    if (self.options.storePage) {
                        var s3 = knox.createClient({
                            key:conf.aws.accessKey,
                            secret:conf.aws.secretAccessKey,
                            bucket:conf.s3DataBucket
                        });
                        var s3path = conf.htmlStoragePath + url.replace('http://', '').replace('https://') + '.html';

                        var buffer = new Buffer(data);
                        var headers = {
                            'Content-Type':'application/html'
                        };
                        s3.putBuffer(buffer, s3path, headers, function (err, res) {
                            cb(err,$, data, headers, cb);
                        });
                    } else {
                        cb(undefined,$, data, headers, cb);
                    }
                }
            ], function (waterfallError, results) {

            })
            /*
             var result = {}
             var data = {}
             var parseOk = false;

             try {
             var container = $('.container')
             container.find('#price_tip').each(function (idx, priceSpan) {
             data.priceString = priceSpan.textContent
             })
             var reviews = []
             $("meta").each(function (mIdx, meta) {
             var property = $(meta).attr('property')
             if (property == 'og:latitude') {
             data.latitude = $(meta).attr('content');
             }
             if (property == 'og:longitude') {
             data.longitude = $(meta).attr('content');
             }
             if (property == 'og:image') {
             if (!data.images) {
             data.images = []
             }
             var imgObj = {}
             imgObj.src = $(meta).attr('content');
             data.images.push(imgObj)
             }

             })

             container.find('#bizPhone').each(function (idx, elem) {
             data.phone = $(elem).text();
             })

             container.find('#bizUrl href').each(function (idx, elem) {
             data.website = $(elem).text();
             })
             container.find('#reviews-other').each(function (idx, reviewsBlock) {
             $(reviewsBlock).find('.review').each(function (rIdx, revBlock) {
             var review = {}
             $(revBlock).find('[itemprop="author"]').each(function (ratIdx, ratBlock) {
             review.author = ratBlock.textContent;
             })

             $(revBlock).find('[itemprop="datePublished"]').each(function (ratIdx, ratBlock) {
             review.dtreviewed = $(ratBlock).attr('content');
             })

             $(revBlock).find('[itemprop="description"]').each(function (ratIdx, ratBlock) {
             review.content = ratBlock.textContent;
             })
             $(revBlock).find('[itemprop="ratingValue"]').each(function (ratIdx, ratBlock) {
             review.rating = $(ratBlock).attr('content');
             })
             reviews.push(review)
             })
             })
             data.reviews = reviews;

             var bizAttributes = {}
             try {
             container.find('#bizAdditionalInfo').each(function (idx, bizAddInfo) {
             $(bizAddInfo).find('dt').each(function (bIdx, infoDesc) {
             var attributeName = $(infoDesc).attr('class')
             var selectorName = 'dd.' + attributeName
             $(bizAddInfo).find(selectorName).each(function (bzIdx, infoValue) {
             data[attributeName.replace('attr-', '')] = infoValue.textContent
             .replace(/[^a-zA-Z 0-9]+/g, '')
             //.replace(/\n/,' ')
             //.replace(/\\t/,' ')
             .replace(/  +/g, ' ')
             .trim()
             })
             })
             })
             } catch (ex) {
             console.log('parse error on #bizAdditionalInfo')
             }

             } catch (ex) {
             console.log('Sizzle error ')
             parseOk = false

             }
             self.window.close()
             var baseData = self.scrape._doc.data
             for (var field in data) {
             if (field == 'tags') {
             if (baseData.tags) {
             for (var j = 0; j < data.tags.length; j++) {
             if (baseData.tags.indexOf(data.tags[j]) == -1) {
             baseData.tags.push(data.tags[j])
             }
             }
             } else {
             baseData[field] = data[field]
             }
             } else {
             baseData[field] = data[field]
             }
             }

             self.options.models.Scrape.findById(job.opts.scrapeId, function (err, scrape) {
             scrape._doc.data = baseData;
             scrape.type = 'location';
             scrape.markModified('data');
             scrape.lastChecked = new Date();
             self.emit('done');
             })

             }

             }
             )
             ;*/

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

exports.createJob = YelpDetailsFactory;

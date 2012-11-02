/**
 * User: philliprosen
 * Date: 9/20/12
 * Time: 5:14 PM
 */
var async = require('async')
var nodeio = require('node.io');
var mongoose = require('mongoose')
var conf = require('../../../../etc/conf.js').production;
var knox = require('knox');
var zlib = require('zlib'),
    InputQueue = require('../../../InputQueue').InputQueue,
    ProxyQueue = require('../../../ProxyQueue').ProxyQueue,
    JobQueue = require('../../../JobQueue').JobQueue;

var s3 = knox.createClient({
    key:conf.aws.accessKey,
    secret:conf.aws.secretAccessKey,
    bucket:conf.s3DataBucket
});
var htmlStoragePath = '/pages/yelp/'

var defaultOptions = {
    "take":1,
    "max":1,
    jsdom:true,
    criteria:{},
    spoof:true,
};

var methods = {
    run:function (pageUrls) {
        var self = this
        self.jobQueue = new JobQueue('default', {redisClient:self.options.redisClient})
        self.proxyQueue = new ProxyQueue('default', {redisClient:self.options.redisClient})

        if (Object.prototype.toString.call(pageUrls) !== '[object Array]') {
            pageUrls = [pageUrls];
        }

        async.forEachLimit(pageUrls, 5, function (url, forEachPageUrlCallback) {

            self.resultObject = resultObject = {
                url:url,
                listings:[]
            }
            console.log(url)

            self.proxyQueue.getNext(function (err, proxyString) {

                if (proxyString && proxyString != 1) {
                    self.options.proxy = proxyString
                    console.log('Using proxy ' + self.options.proxy)
                }

                self.getHtml(url, function (err, $, data, headers) {
                        var htmlSelf = this
                        if (err) {
                            //this.exit(err)
                            console.log(' ')
                            console.log('ERROR')
                            console.log(url + ' ' + err + ' ' + self.options.proxy)
                            htmlSelf.emit(url + ' ' + err)
                        } else {
                            var s3path = htmlStoragePath + url.replace('http://', '').replace('https://') + '.html';
                            async.waterfall([
                                /*                 function saveHtml(cb) {
                                 var buffer = new Buffer(data);
                                 var headers = {
                                 'Content-Type':'application/html'
                                 };

                                 s3.putBuffer(buffer,s3path, headers, function (err, res) {
                                 cb(err);
                                 });
                                 },*/
                                function processPage(processPageCallback) {
                                    var results = []

                                    var businessresults = $('#businessresults')
                                    if (businessresults.length > 0) {
                                        businessresults.find('.businessresult').each(function (idx, bres) {
                                            var scrapedFields = {s3path:s3path}
                                            scrapedFields.name = ''
                                            $(bres).find('.itemheading').each(function (itIdx, itemHeading) {
                                                $(itemHeading).find('a').each(function (aIdx, itemLink) {
                                                    scrapedFields.url = 'http://www.yelp.com' + itemLink.href.replace('file://','')
                                                    var highlighted = false
                                                    var name = itemLink.textContent
                                                    if (name) {
                                                        name = name.substring(name.indexOf('.') + 1, name.length);
                                                        name = name.replace(/\t/, '').replace(/\n/, '').trim()
                                                    }
                                                    scrapedFields.name = name
                                                })
                                            })
                                            $(bres).find('.reviews').each(function (idx, rev) {
                                                scrapedFields.reviewCount = rev.textContent
                                                scrapedFields.reviewCount = scrapedFields.reviewCount.replace('reviews', '')
                                            })
                                            var starImg = $(bres).find('.star-img');
                                            if (starImg && starImg.length > 0) {
                                                scrapedFields.ratingText = $(starImg[0]).attr('title');
                                                if (scrapedFields.ratingText) {
                                                    scrapedFields.rating = scrapedFields.ratingText.replace(' star rating', '')
                                                }
                                            }

                                            scrapedFields.neighborhoods = []
                                            $(bres).find('address').each(function (idx, addDiv) {
                                                $(addDiv).find('div').each(function (dIdx, div) {
                                                        if (dIdx == 0) {
                                                            if (div.textContent) {
                                                                var addrParts = div.innerHTML.split('<br>');
                                                                if (addrParts.length > 0) {
                                                                    scrapedFields.address = addrParts[0]
                                                                        .replace(/\t/, '')
                                                                        .replace(/\n/, '')
                                                                        .replace('<br />', ' ')
                                                                        .replace(/  +/g, ' ')
                                                                        .trim()
                                                                    //console.log(scrapedFields.address)
                                                                    if (addrParts[1]) {
                                                                        var localeParts = addrParts[1].split(',')
                                                                        if (localeParts.length > 0) {
                                                                            scrapedFields.city = localeParts[0]
                                                                                .replace(/\t/, '')
                                                                                .replace(/\n/, '')
                                                                                .trim()
                                                                            if (localeParts[1]) {
                                                                                var stateZipParts = localeParts[1]
                                                                                    .replace(/\t/, '')
                                                                                    .replace(/\n/, '')
                                                                                    .trim()
                                                                                    .split(' ')
                                                                                if (stateZipParts.length > 0) {
                                                                                    scrapedFields.state = stateZipParts[0]
                                                                                        .replace(/\t/, '')
                                                                                        .replace(/\n/, '')
                                                                                        .trim()
                                                                                    if (stateZipParts[1]) {
                                                                                        scrapedFields.zip = stateZipParts[1]
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        if (div.title == 'phone') {
                                                            scrapedFields.phone = div.textContent
                                                                .replace(/\t/, '')
                                                                .replace(/\n/, '')
                                                                .trim()
                                                        }
                                                    }
                                                )
                                            })

                                            scrapedFields.tags = []
                                            $(bres).find('.itemcategories').each(function (icIdx, icDiv) {
                                                $(icDiv).find('.category').each(function (cIdx, catHref) {
                                                    scrapedFields.tags.push(catHref.textContent)
                                                })
                                            })
                                            $(bres).find('.itemneighborhoods').each(function (icIdx, icDiv) {
                                                $(icDiv).find('.place').each(function (cIdx, catHref) {
                                                    scrapedFields.neighborhoods.push(catHref.textContent)
                                                })
                                            })
                                            if (scrapedFields.name) {
                                                if (scrapedFields.name.indexOf('- CLOSED') > -1) {
                                                    scrapedFields.closed = true
                                                }
                                            }
                                            results.push(scrapedFields)

                                        })
                                    }
                                    processPageCallback(undefined, results)
                                }
                            ], function waterfallCallback(err, results) {
                                htmlSelf.window.close()
                                var scrapeResults = []
                                async.forEach(results, function (listingEntry, forEachCallback) {
                                    if (err) {
                                        forEachCallback(scrapeSaveError)
                                    } else {
                                        /*var scrape = new Scrape({network:'yelp', type:'location', data:listingEntry, params:{amex:true, s3path:listingEntry.s3path, nyclm:true}})
                                         scrape.save(function (scrapeSaveError, scrapeSaveResult) {
                                         if (scrapeSaveResult) {
                                         scrapeResults.push(scrapeSaveResult)
                                         }
                                         */
                                        forEachCallback(scrapeSaveError, scrapeSaveResult)

                                        //                                      })

                                    }
                                }, function (err) {
                                    forEachPageUrlCallback(err);
                                })
                            })
                        }

                    }
                );
            })
        }, function (forEachPageUrlError) {
            if (forEachPageUrlError) {
                self.emit(forEachPageUrlError)
            } else {
                self.emit('done')
            }
        });

    },
    complete:function (callback) {
        console.log('Job complete.');
        callback(); //Important!
    }
}

exports.options = defaultOptions;
exports.methods = methods;


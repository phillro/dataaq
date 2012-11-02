/**
 * User: philliprosen
 * Date: 9/20/12
 * Time: 5:14 PM
 */
var async = require('async')
var nodeio = require('node.io');
var mongoose = require('mongoose')
var conf = require('../../../etc/conf.js').production;
var scrapeitConnectionString = 'mongodb://' + conf.mongo_conf.scrapeit2.user + ':' + conf.mongo_conf.scrapeit2.password + '@' + conf.mongo_conf.scrapeit2.host + ':' + conf.mongo_conf.scrapeit2.port + '/' + conf.mongo_conf.scrapeit2.dbName
var scrapeitDb = mongoose.createConnection(scrapeitConnectionString);

var skyfetchLiveConnectionString = 'mongodb://' + conf.mongo_conf.skyflive.user + ':' + conf.mongo_conf.skyflive.password + '@' + conf.mongo_conf.skyflive.host + ':' + conf.mongo_conf.skyflive.port + '/' + conf.mongo_conf.skyflive.dbName
var skyfetchDb = mongoose.createConnection(skyfetchLiveConnectionString)
var skyfetchDataUtils = new require('../../../lib/skyfDataUtils.js')({mongooseConnectionString:skyfetchLiveConnectionString})

var ScrapeSchema = require('../../../models/scrape.js')
var Scrape = scrapeitDb.model('Scrape', ScrapeSchema)
var scrapeDataUtils = new require('../../../lib/skyfDataUtils.js')({mongooseConnectionString:scrapeitConnectionString})
var InputQueueSchema = require('../../../models/inputqueue.js')
var inputQueue = scrapeitDb.model('locationinputqueue', InputQueueSchema)

var ConfigDataSchema = require('../../../models/configdata.js')
var ConfigData = scrapeitDb.model('ConfigData', ConfigDataSchema)
var HistoryHelper = new require('../../../lib/HistoryHelper')({mongooseConnectionString:scrapeitConnectionString})
var knox = require('knox');
var OrdrinCats = skyfetchDb.model('ordrin_cats', require('../../../models/cats.js'));
var proxyUtil = new require('../../../lib/ProxyUtil')(scrapeitDb);
var zlib = require('zlib');

var s3 = knox.createClient({
    key:conf.aws.accessKey,
    secret:conf.aws.secretAccessKey,
    bucket:conf.s3DataBucket
});
var htmlStoragePath = '/pages/yelp/'

var options = {
    "take":1,
    "max":1,
    jsdom:true,
    criteria:{},
    spoof:true,
};

var proxyList = [
    'http://nycdevanon:aXy8YJyDe@64.87.61.37:20912',
    'http://nycdevanon:aXy8YJyDe@69.172.211.84:56170',
    'http://nycdevanon:aXy8YJyDe@184.82.119.187:40100',
    'http://nycdevanon:aXy8YJyDe@108.62.146.22:62912',
    'http://nycdevanon:aXy8YJyDe@50.31.68.197:13601',
    'http://nycdevanon:aXy8YJyDe@216.156.128.184:9111',
    //'http://nycdevanon:aXy8YJyDe@64.120.240.100:40100',
    'http://nycdevanon:aXy8YJyDe@209.250.7.127:27737',
    'http://nycdevanon:aXy8YJyDe@50.31.69.142:13601',
    'http://nycdevanon:aXy8YJyDe@173.239.56.29:6802',
    'http://nycdevanon:aXy8YJyDe@38.69.196.85:5861',
    'http://nycdevanon:aXy8YJyDe@108.62.89.203:11316',
    'http://nycdevanon:aXy8YJyDe@216.223.219.7:22092',
    'http://nycdevanon:aXy8YJyDe@108.62.16.49:54827',
    'http://nycdevanon:aXy8YJyDe@173.239.57.158:6802'
]

function nextProxy() {
    var nextProxy = proxyList.shift()
    proxyList.push(nextProxy)
    return nextProxy
}

var methods = {
    options:options,
    input:[
        'http://www.yelp.com/search?find_desc=restaurants&find_loc=10002&rpp=40&start=80',
        'http://www.yelp.com/search?find_desc=restaurants&find_loc=10002&rpp=40&start=240',
        'http://www.yelp.com/search?find_desc=restaurants&find_loc=10002&rpp=40&start=680',
        'http://www.yelp.com/search?find_desc=restaurants&find_loc=10002&rpp=40&start=680',
        'http://www.yelp.com/search?find_desc=restaurants&find_loc=10002&rpp=40&start=840',
    ],
    run:function (pageUrls) {
        var self = this

        if (Object.prototype.toString.call(pageUrls) !== '[object Array]') {
            pageUrls = [pageUrls];
        }

        async.forEachLimit(pageUrls,5, function (url, forEachPageUrlCallback) {

            self.resultObject = resultObject = {
                url:url,
                listings:[]
            }
            console.log(url)

            //self.options.proxy = nextProxy();
            //self.options.proxy = proxy.proxyUrl
            console.log('Using proxy ' + self.options.proxy)
                console.log('Grab')
            self.getHtml(url, function (err, $, data, headers) {
                    var htmlSelf = this
                    if (err) {
                        //this.exit(err)
                        console.log(' ')
                        console.log('ERROR')
                        console.log(url + ' ' + err + ' ' + self.options.proxy)
                        htmlSelf.emit(url + ' ' + err)
                    } else {
                        var s3path = htmlStoragePath + url.replace('http://','').replace('https://')+'.html';
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
                                                scrapedFields.url = 'http://www.yelp.com' + itemLink.href
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
                                        /*.each(function (idx, starImg) {
                                         $(starImg).find('img').each(function (idx, img) {
                                         scrapedFields.ratingText = img.title
                                         if (scrapedFields.ratingText) {
                                         scrapedFields.rating = scrapedFields.ratingText.replace(' star rating', '')
                                         }
                                         })
                                         })*/
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
                                //  Scrape.findOne({'data.url':listingEntry.url}, function (err, existingScrape) {
                                if (err) {
                                    forEachCallback(scrapeSaveError)
                                } else {
                                    // if (!existingScrape) {
                                    var scrape = new Scrape({network:'yelp', type:'location', data:listingEntry, params:{amex:true, s3path: listingEntry.s3path, nyclm:true}})
                                    scrape.save(function (scrapeSaveError, scrapeSaveResult) {
                                        if (scrapeSaveResult) {
                                            scrapeResults.push(scrapeSaveResult)
                                        }

                                        forEachCallback(scrapeSaveError, scrapeSaveResult)

                                    })

                                    //    } else {
                                    //    forEachCallback()
                                    //}
                                }
                                //  })
                            }, function (err) {
                                forEachPageUrlCallback(err);
                            })
                        })
                    }

                }
            );
            //})
        }, function (forEachPageUrlError) {
            if (forEachPageUrlError) {
                self.emit(forEachPageUrlError)
            } else {
                self.emit('done')
            }
        });

    },
    fail:function (input, status) {
        console.log(' ')
        console.log('FAIL ' + status)
        console.log(input)
        console.log(' ')
    },
    output:function (results) {
        var self = this
        for (var r = 0; r < results.length; r++) {
            var resultObject = results[r];

        }

        console.log(results.length + ' done.')
    },
    complete:function (callback) {
        HistoryHelper.finishItem(this.options.historyId, {'condition':'Job Complete'})
        console.log('Job complete.');
        callback(); //Important!
    }
}

exports.options = options;
exports.methods = methods;

var yelpSearchJob = new nodeio.Job(options, methods);

nodeio.start(yelpSearchJob, options)


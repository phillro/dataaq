var async = require('async')
var nodeio = require('node.io');
var mongoose = require('mongoose')
var conf = require('../../../../etc/conf.js').production;
var extend = require('node-extend'),
    redis = require('redis'),
    VenueUtil = require('venue-util'),
    nodeio = require('node.io'),
    InputQueue = require('../../../../lib/InputQueue').InputQueue,
    ProxyQueue = require('../../../../lib/ProxyQueue').ProxyQueue,
    JobQueue = require('../../../../lib/JobQueue').JobQueue,
    Job =  require('../../../JobQueue').Job;

var options = {
    "take":1,
    "max":1,
    jsdom:true,
    criteria:{},
    saveAttempted:0,
    saveComplete:0,
    spoof:true,
    first:true,
    htmlStoragePath:'/pages/yelp/',
    proxyQueue:function () {
        return false
    },
    jobQueue:false
};

var methods = {
    run:function (params) {
        var self = this
        self.jobQueue = new JobQueue('yelpsearchresults', {redisClient:self.options.redisClient})
        self.proxyQueue = new ProxyQueue('default', {redisClient:self.options.redisClient})

        if (Object.prototype.toString.call(params) !== '[object Array]') {
            params = [params];
        }

        async.forEachLimit(params, 1, function (searchParam, forEachSearchParamCallback) {
            var url = 'http://www.yelp.com/search?';
            var fieldCount = 0;
            for (var field in searchParam) {
                if (fieldCount > 0) {
                    url += '&'
                }
                url += field + '=' + searchParam[field]
                fieldCount++;
            }
            url += '&rpp=40';
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
                        self.skip();
                    } else {
                        var rangeText = $('.range-of-total span').text();
                        var rangeParts = rangeText.split(' ');
                        var totalResults = rangeParts[rangeParts.length - 1];
                        var pages = Math.round(totalResults / 40) + 1;
                        var pageUrls = [];
                        pageUrls.push(url);
                        for (var i = 1; i < pages; i++) {
                            var start = 40 * i;
                            pageUrls.push(url + '&start=' + start);
                        }
                        htmlSelf.window.close();
                        async.forEach (pageUrls,function(pageUrl, forEachCallback){

                            var jobObj = new Job('yelp', 'yelpProcessResultPage', {input:[pageUrl]}, 'cli');
                            self.jobQueue.push(jobObj, forEachCallback)
                        },function(forEachError){
                            self.emit('added '+pageUrls.length+' jobs');
                        });

                    }

                })
            })

        }, function (forEachSearcParamError) {
            if (forEachSearcParamError) {
                console.log(forEachSearcParamError)
            } else {
                console.log('done')
            }
            self.emit(['done'])
        });

    },
    complete:function (cb) {
        cb();
    }
}

exports.options = options;
exports.methods = methods;

/*var i1 = {
 find_desc:'restaurants',
 find_loc:'10014',
 }

 var redisClient = redis.createClient(conf.redis.port, conf.redis.host);
 var yelpInputQueue = new InputQueue('yelpsearchinputqueue', {redisClient:redisClient});
 yelpInputQueue.push(JSON.stringify(i1), function (err, res) {

 var jobQueue = new require('../../../../lib/JobQueue').JobQueue('default', {redisClient:redisClient})
 var proxyQueue = new require('../../../../lib/ProxyQueue').ProxyQueue('default', {redisClient:redisClient})
 //  options.jobQueue = jobQueue;
 //    options.proxyQueue = proxyQueue;

 var yelpSearchJob = new nodeio.Job(options, methods);

 nodeio.start(yelpSearchJob, {redisClient:redisClient})
 })
 */
/**
 * User: philliprosen
 * Date: 11/3/12
 * Time: 10:52 PM
 */
var JobQueue = require('../../../JobQueue').JobQueue,
    Job = require('../../../JobQueue').Job,
    async = require('async');
function processPageData($, pageData, headers, processPageDataCallback) {
    var results = []
    var subdomain = 'http://www.menupages.com/';
    try {

        var trCount = 0
        $('.search-results').find('tr').each(function (trIdx, trElem) {
            if (trIdx > 0) {
                var data = {}
                var test = trElem.innerText
                $(trElem).find('.name-address .link').each(function (trAIdx, aTag) {
                    if (aTag._childNodes.length > 1) {
                        try {
                            data.name = aTag._childNodes[1].__nodeValue;
                            if (data.name.indexOf('(CLOSED)') > -1) {
                                data.closed = true;
                            } else {
                                data.closed = false;
                            }

                        } catch (exc) {
                        }
                    }
                    if (trAIdx == 0) {
                        data.url = subdomain + aTag.href
                        data.url = data.url.replace('file:///', '');
                    }
                })

                var ratings = {'http://static.menupages.com/images/star0.gif':0,
                    'http://static.menupages.com/images/star1.gif':1,
                    'http://static.menupages.com/images/star2.gif':2,
                    'http://static.menupages.com/images/star3.gif':3,
                    'http://static.menupages.com/images/star4.gif':4,
                    'http://static.menupages.com/images/star5.gif':5}

                $(trElem).find('.rating img').each(function (imgIdx, imgTag) {
                    var imgSrc = imgTag.src
                    if (ratings[imgSrc]) {
                        data.rating = ratings[imgSrc]
                    }
                })

                $(trElem).find('.price').each(function (tdIdx, tdTag) {
                    $(tdTag).find('.price1').each(function () {
                        data.priceString = '$';
                    })
                    $(tdTag).find('.price2').each(function () {
                        data.priceString = '$$';
                    })
                    $(tdTag).find('.price3').each(function () {
                        data.priceString = '$$$';
                    })
                    $(tdTag).find('.price4').each(function () {
                        data.priceString = '$$$$';
                    })
                    $(tdTag).find('.price5').each(function () {
                        data.priceString = '$$$$$';
                    })
                })

                $(trElem).find('.reviews').each(function (tdIdx, tdTag) {
                    data.reviewCount = tdTag.innerHTML
                })

                results.push(data)

            }
        });

        processPageDataCallback(undefined, results);
    } catch (ex) {
        processPageDataCallback(ex.toString(), results);
    }

}

function updateScrapeMethod($, pageData, headers, scrapeData, scrape, options, updateScrapeMethodCallback) {
    var menupageRestaurantJobQueue = new JobQueue(options.jobQueueName, {redisClient:options.redisClient})
    var baseData = scrape._doc.data
    var scrapes = [];
    var detailsJobQueue = new JobQueue('menupagedetails', {redisClient:options.redisClient});
    var menuJobQueue = new JobQueue('menupagemenus', {redisClient:options.redisClient});

    async.forEach(scrapeData, function (resultObj, forEachCallback) {
        var scrape = new options.models.Scrape({network:'menupages', type:'location', data:resultObj, params:{amex:true, url:options.job.input[0]}})
        scrape.save(function (err, scrapeSaveResult) {
            async.waterfall([
                function saveDetailJob(saveDetailJobCb) {
                    var detailsJob = new Job('menupages', 'menupagesdetails', {input:[resultObj.url], scrapeId:scrapeSaveResult._id.toString()}, 'cli');
                    detailsJob.processorMethods = 'networks/menupages/DetailProcessor';
                    detailsJob.baseJob = 'networks/internal/defaultPageScraper';
                    detailsJobQueue.push(detailsJob,saveDetailJobCb);
                },
                function saveMenuJob(res, saveMenuJob){
                    var menuUrl = resultObj.url + 'menu';
                    var menuJob = new Job('menupages', 'menupagesmenu', {input:[menuUrl], scrapeId:scrapeSaveResult._id.toString()}, 'cli');
                    menuJob.processorMethods = 'networks/menupages/MenuProcessor';
                    menuJob.baseJob = 'networks/internal/defaultPageScraper';
                    menuJobQueue.push(menuJob,saveMenuJob);

                }
            ], function (waterfallError, results) {
                forEachCallback(waterfallError)
            })
        })
    }, function (forEachError) {
        updateScrapeMethodCallback(forEachError, $, pageData, headers, scrapeData, scrapes)
    });

}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
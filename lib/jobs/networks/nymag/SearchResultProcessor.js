var JobQueue = require('../../../JobQueue').JobQueue,
    Job = require('../../../JobQueue').Job,
    async = require('async');
function processPageData($, pageData, headers, processPageDataCallback) {
    var results = []

    try {
        var count = 0;
        $('#resultsFound tr').each(function (idx, elem) {
            var data = {}
            $(elem).find('td').each(function (rIdx, rElem) {
                if (rIdx == 0) {
                    $(rElem).find('.result dt a').each(function (nIdx, nElem) {
                        data.name = $(nElem).text();
                        data.url = nElem.href;
                    });
                    $(rElem).find('.dek p').each(function (nIdx, nElem) {
                        data.description = $(nElem).text();
                    });
                }
                if (rIdx == 1) {
                    data.cuisine = [];
                    $(rElem).find('ul li').each(function (nIdx, nElem) {
                        data.cuisine.push($(nElem).text());
                    });
                }
                if (rIdx == 2) {
                    $(rElem).find('p').each(function (nIdx, nElem) {
                        var priceString = $(nElem).text();
                        if(priceString){
                            data.priceString = priceString.indexOf('-')>-1&& priceString.length> priceString.indexOf('-')?priceString.split('-')[1]:priceString;
                        }
                    });
                }
                if(rIdx == 3){
                    data.neighborhoods=[];
                    $(rElem).find('p').each(function (nIdx, nElem) {
                        data.neighborhoods.push($(nElem).text());
                    })
                }
            })

            if (data.name && data.url) {
                results.push(data);
            }
        })

        processPageDataCallback(undefined, results);
    } catch (ex) {
        processPageDataCallback(ex.toString(), results);
    }

}

function updateScrapeMethod($, pageData, headers, scrapeData, scrape, options, updateScrapeMethodCallback) {
    var baseData = scrape._doc.data
    var scrapes = [];
    var detailsJobQueue = new JobQueue('nymagdetail', {redisClient:options.redisClient});

    async.forEach(scrapeData, function (resultObj, forEachCallback) {
        var scrape = new options.models.Scrape({network:'nymag', type:'location', data:resultObj, params:{amex:true, url:options.job.input[0]}})
        scrape.save(function (err, scrapeSaveResult) {
            async.waterfall([
                function saveDetailJob(saveDetailJobCb) {
                    var detailsJob = new Job('nymagpage', 'nymagpagedetails', {input:[resultObj.url], scrapeId:scrapeSaveResult._id.toString()}, 'cli');
                    detailsJob.processorMethods = 'networks/nymag/DetailProcessor';
                    detailsJob.baseJob = 'networks/internal/defaultPageScraper';
                    detailsJobQueue.push(detailsJob, saveDetailJobCb);
                },
            ], function (waterfallError, results) {
                forEachCallback(waterfallError)
            })
        })
    }, function (forEachError) {
        updateScrapeMethodCallback(forEachError, $, pageData, headers, scrapeData, scrapes)
    });
    //updateScrapeMethodCallback(forEachError, $, pageData, headers, scrapeData, {})

}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
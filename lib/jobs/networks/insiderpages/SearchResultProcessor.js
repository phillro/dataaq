var JobQueue = require('../../../JobQueue').JobQueue,
    Job = require('../../../JobQueue').Job,
    async = require('async');
function processPageData($, pageData, headers, processPageDataCallback) {
    var results = []

    try {
        var count = 0;
        $('#search_results .content.search_result').each(function (idx, elem) {
            var data = {}
            $(elem).find('h2 a').each(function (idx, rElem) {
                data.name = $(rElem).text();
                data.url = 'http://www.insiderpages.com/' + rElem.href.replace('file:///', '');
            })
            $(elem).find('.rating_box abbr').each(function (idx, rElem) {
                data.rating = rElem.title;

            })

            results.push(data);
        })

        processPageDataCallback(undefined, results);
    } catch (ex) {
        processPageDataCallback(ex.toString(), results);
    }

}

function updateScrapeMethod($, pageData, headers, scrapeData, scrape, options, updateScrapeMethodCallback) {
    var baseData = scrape._doc.data
    var scrapes = [];
    var detailsJobQueue = new JobQueue('default', {redisClient:options.redisClient});

    async.forEach(scrapeData, function (resultObj, forEachCallback) {
        var scrape = new options.models.Scrape({network:'insiderpages', type:'location', data:resultObj, params:{amex:true, url:options.job.input[0]}})
        scrape.save(function (err, scrapeSaveResult) {
            async.waterfall([
                function saveDetailJob(saveDetailJobCb) {
                    var detailsJob = new Job('insiderpages', 'insiderpagesdetails', {input:[resultObj.url], scrapeId:scrapeSaveResult._id.toString()}, 'cli');
                    detailsJob.processorMethods = 'networks/insiderpages/DetailProcessor';
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
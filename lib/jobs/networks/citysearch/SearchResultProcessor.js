var JobQueue = require('../../../JobQueue').JobQueue,
    Job = require('../../../JobQueue').Job,
    async = require('async');
function processPageData($, pageData, headers, processPageDataCallback) {
    var results = []

    try {
        var count = 0;
        $('#naturalResults .row.naturalResult').each(function (idx, elem) {
            var data = {}
            $(elem).find('.searchContent h4').each(function (idx, rElem) {
                var name = $(rElem).text();
                name = name.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ');
                data.name = name.substring(name.indexOf('.') + 1, name.length).trim();
            })

            data.tags = [];
            $(elem).find('.secondaryText .categories').each(function (idx, rElem) {
                var tags = $(rElem).text();
                data.tags = tags.split(',')
            })
            var textValueFields = {
                '.street-address':'address',
                '.locality':'city',
                '.region':'state',
                '.postal-code':'zip'
            }

            for (var f in textValueFields) {
                $(elem).find(f).each(function (idx, rElem) {
                    var value = $(rElem).text().trim();
                    if (value.substring((value.length - 1), value.length) == ',') {
                        value = value.substring(0, value.length - 1)
                    }
                    data[textValueFields[f]] = value;
                })
            }

            $(elem).find('.neighborhood').each(function (idx, rElem) {
                var neighborhoods = $(rElem).text().replace('Neighborhood:', '').trim().split(',')
                data.neighborhoods = neighborhoods;
            })

            $(elem).find('.geo .longitude').each(function (idx, rElem) {
                data.latitude = $(rElem).text();
            })

            $(elem).find('.geo .longitude').each(function (idx, rElem) {
                data.longitude = $(rElem).text();
            })

            $(elem).find('.url.fn.org').each(function (idx, rElem) {
                data.url = rElem.href

                var t = 1;
            })
            count++;
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
    var detailsJobQueue = new JobQueue('citysearchdetails', {redisClient:options.redisClient});

    async.forEach(scrapeData, function (resultObj, forEachCallback) {
        var scrape = new options.models.Scrape({network:'citysearch', type:'location', data:resultObj, params:{amex:true, url:options.job.input[0]}})
        scrape.save(function (err, scrapeSaveResult) {
            async.waterfall([
                function saveDetailJob(saveDetailJobCb) {
                    var detailsJob = new Job('citysearch', 'citysearchdetails', {input:[resultObj.url], scrapeId:scrapeSaveResult._id.toString()}, 'cli');
                    detailsJob.processorMethods = 'networks/citysearch/DetailProcessor';
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

}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
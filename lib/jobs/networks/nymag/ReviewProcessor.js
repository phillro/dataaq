var JobQueue = require('../../../JobQueue').JobQueue,
    Job = require('../../../JobQueue').Job,
    async = require('async');
function processPageData($, pageData, headers, processPageDataCallback) {
    var data = {}
    try {
        var container = $('#content-primary');
        data.reviews = [];
        container.find('.urr-container').each(function (idx, elem) {
            var review = {};
            $(elem).find('h2').each(function (rIdx, rElem) {
                review.title = $(rElem).text();
            })
            $(elem).find('.urr-usr-date').each(function (rIdx, rElem) {
                review.dtreviewed = $(rElem).text();


                review.dtreviewed=review.dtreviewed.substring(
                    review.dtreviewed.indexOf('on')+2,
                    review.dtreviewed.length
                ).replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ').trim();
                var t=1
            })
            $(elem).find('.urr-usr-date a').each(function (rIdx, rElem) {
                review.author = $(rElem).text();
            })

            $(elem).find('.overall-num').each(function (rIdx, rElem) {
                review.rating = $(rElem).text();
                if(review.rating){
                    try{
                        review.rating=parseFloat(review.rating)/2;
                    }catch(ex){}
                }
            })

            $(elem).find('.urr-description').each(function (rIdx, rElem) {
                review.content = $(rElem).text();
            })

            data.reviews.push(review)

        })

        processPageDataCallback(undefined, data);
    }
    catch
        (ex) {
        console.log('Sizzle error ')
        processPageDataCallback(ex.toString(), data);

    }
}

function mergeArrays(arr1, arr2) {
    var merged = [];
    var normMerged = [];
    //for (var i = 0; i < arr1.length; i++) {
    var t = arr1.length;
    while (t--) {
        var normed = arr1[i].toString().toLowerCase().replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ');
        if (normMerged.indexOf(normed) == -1) {
            merged.push(arr1[i]);
            normMerged.push(normed);
        }
    }

    var t = arr2.length;
    while (t--) {
        var normed = arr2[i].toString().toLowerCase().replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ');
        if (normMerged.indexOf(normed) == -1) {
            merged.push(arr2[i]);
            normMerged.push(normed);
        }
    }

    return merged;
}

function updateScrapeMethod($, pageData, headers, scrapeData, scrape, options, updateScrapeMethodCallback) {
    var baseData = scrape._doc.data
    for (var field in scrapeData) {
        if (typeof baseData[field]=='object' && scrapeData[field]=='object' && scrapeData[field].prototype.toString() === '[object Array]' && baseData[field].prototype.toString()) {
            baseData[field] = mergeArrays(scrapeData[field], baseData[field])
        }
        /*if (field == 'tags') {
         if (baseData.tags) {
         for (var j = 0; j < scrapeData.tags.length; j++) {
         if (baseData.tags.indexOf(scrapeData.tags[j]) == -1) {
         baseData.tags.push(scrapeData.tags[j])
         }
         }
         } else {
         baseData[field] = scrapeData[field]
         }
         }*/
        else {
            baseData[field] = scrapeData[field]
        }
    }
    scrape._doc.data = baseData;
    if (options.sepath) {
        scrape._doc.params.s3path = options.s3path;
    }
    if (options.job) {
        scrape._doc.params.juobuid = options.job.uid;
    }
    scrape.type = options.scrapeType;
    scrape.markModified('data');
    scrape.lastChecked = new Date();

    var reviewQueue = new JobQueue('nymagreviews', {redisClient:options.redisClient});

    async.waterfall([
        function saveScrape(cb) {
            scrape.save(function (err, scrapeSaveResult) {
                if (scrapeSaveResult) {
                    console.log('Saved ' + scrapeSaveResult._id)
                }
                cb(err, $, pageData, headers, scrapeData, scrapeSaveResult);
            })
        }
    ], function (waterfallError, $, pageData, headers, scrapeData, scrapeSaveResult) {
        updateScrapeMethodCallback(undefined, $, pageData, headers, scrapeData, scrapeSaveResult)
    })

    updateScrapeMethodCallback(undefined, $, pageData, headers, scrapeData, {})
}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
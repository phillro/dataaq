var JobQueue = require('../../../JobQueue').JobQueue,
    Job = require('../../../JobQueue').Job,
    async = require('async');
function processPageData($, pageData, headers, processPageDataCallback) {
    var data = {}
    try {
        var container = $('#content');
        var textValueFields = {
            '.street-address':'address',
            '.locality':'city',
            '.region':'state',
            '.postal-code':'zip',
        }

        for (var f in textValueFields) {
            container.find(f).each(function (idx, elem) {
                data[textValueFields[f]] = $(elem).text();
                data[textValueFields[f]] = data[textValueFields[f]].trim();
            })
        }

        var geo = {};
        container.find('.geo .latitude').each(function (idx, elem) {
            geo.lat = $(elem).text();
        })
        container.find('.geo .longitude').each(function (idx, elem) {
            geo.lon = $(elem).text();
        })
        if (geo.lat && geo.lon) {
            try {
                geo.lat = parseFloat(geo.lat);
                geo.lon = parseFloat(geo.lon);
                data.geo = geo;
            } catch (ex) {
            }
        }

        container.find('.summary-address p').each(function (idx, elem) {
            var tmp = $(elem).text();
            if (tmp.indexOf('Subway Directions') > -1 && tmp.indexOf('Send to Phone') > -1) {
                data.phone = tmp.substring(tmp.indexOf('Subway Directions') + 17, tmp.indexOf('Send to Phone')).trim();
            }
        });

        container.find('.summary-details').each(function (idx, elem) {
            $(elem).find('.summary-reader-avg .average').each(function (rIdx, rElem) {
                data.rating = $(rElem).text();
                if (data.rating) {
                    try {
                        data.rating = parseFloat(data.rating) / 2;
                    } catch (ex) {
                    }
                }
            })
        })

        data.tips = [];
        container.find("b:contains('Recommended Dishes')").each(function (idx, elem) {
            var rec = $(elem).next()
            try {
                var txt = $(rec).text();
                if (txt) {
                    var tip = {
                        text:'Recommended Dishes: '+txt.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' '),
                        type:'recommended',
                        createdAt:new Date()
                    }
                    data.tips.push(tip);
                }
            } catch (ex) {
            }
        })

        var features = {};
        container.find('.listing-rightcol .details h3').each(function (idx, elem) {
            var featureName = $(elem).text().replace(/\s/g, '').replace(/\-/g, '').toLowerCase();
            var value = $(elem).next();
            if ($(value).is("p")) {
                features[featureName] = $(value).text();
            }
            if ($(value).is("ul")) {
                var values = [];
                $(value).find("li").each(function (lIdx, lElem) {
                    values.push($(lElem).text().trim());
                })
                features[featureName] = values;
            }
        })

        for (var f in features) {
            switch (f) {
                case 'reservations':
                    data.reservations = features[f] == 'Not Accepted' ? false : true;
                    data.reservationstext = features[f];
                    break;
                case 'paymentmethods':
                    data.creditcards = features[f].indexOf('Express') > -1 || features[f].indexOf('Master') > -1 || features[f].indexOf('Visa') > -1 ? true : false;
                    break;

            }

        }

        var valueFields = {
            'alchohol':'alchohol',
            'hours':'hours',
            'paymentmethods':'paymentmethods',
            'nearbysubwaystops':'transportation'
        }

        for (var v in valueFields) {
            if (features[v]) {
                data[valueFields[v]] = features[v];
            }
        }

        data.goodformeal = [];
        data.features = [];
        if (features['specialfeatures']) {
            for (var i = 0; i < features['specialfeatures'].length; i++) {
                var feature = features['specialfeatures'][i];
                var goodformeal = [
                    'Breakfast',
                    'Brunch - Weekend',
                    'Late-Night Dinning',
                    'Lunch',
                    'Dinner'
                ];
                if (goodformeal.indexOf(feature) > -1) {
                    data.goodformeal.push(feature);
                    features['specialfeatures'][i] = false;
                }
                if (feature == 'Romantic') {
                    data.ambience = data.ambience ? data.ambience + ', ' + feature : feature;
                    features['specialfeatures'][i] = false;
                }

                if (feature == 'Singles Scene') {
                    data.ambience = data.ambience ? data.ambience + ', ' + feature : feature;
                    features['specialfeatures'][i] = false;
                }
                if (feature == 'Delivery') {
                    data.delivery = true;
                    features['specialfeatures'][i] = false;
                }
                if (feature == 'WiFi') {
                    data.wifi = true;
                    features['specialfeatures'][i] = false;
                }
                if (feature == 'Take-Out') {
                    data.takeout = true;
                    features['specialfeatures'][i] = false;
                }
                if (feature == 'Good for Groups') {
                    data.groups = true;
                    features['specialfeatures'][i] = false;
                }

                if (feature == 'Outdoor Dining') {
                    data.outdoorseating = true;
                    features['specialfeatures'][i] = false;
                }

            }
            for (var i = 0; i < features['specialfeatures'].length; i++) {
                if (features['specialfeatures'][i]) {
                    data.features.push(features['specialfeatures'][i]);
                }
            }

        }

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
    if (options.s3path) {
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
        },
        function queueReviewsJob($, pageData, headers, scrapeData, scrapeSaveResult, cb) {
            var input = [
                scrape._doc.data.url.replace('/listings/', '/urr/listings/').replace('/index.html','/?sort=recent')
            ]
            var detailsJob = new Job('nymagrev', 'nymagreviews', {input:input, scrapeId:scrapeSaveResult._id.toString()}, 'cli');
            detailsJob.processorMethods = 'networks/nymag/ReviewProcessor';
            detailsJob.baseJob = 'networks/internal/defaultPageScraper';
            reviewQueue.push(detailsJob, function (err, pR) {
                cb(undefined, $, pageData, headers, scrapeData, scrapeSaveResult)
            });

        }
    ], function (waterfallError, $, pageData, headers, scrapeData, scrapeSaveResult) {
        updateScrapeMethodCallback(undefined, $, pageData, headers, scrapeData, scrapeSaveResult)
    })

//updateScrapeMethodCallback(undefined, $, pageData, headers, scrapeData, {})
}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
function processPageData($, pageData, headers, processPageDataCallback) {
    var data = {}
    try {
        var container = $('#content-container')
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

        container.find('.phonenew strong').each(function (idx, elem) {
            data.phone = $(elem).text();
        })

        container.find('dl.serves.note').each(function (idx, elem) {
            data.phone = $(elem).text();
        })

        processPageDataCallback(undefined, data);
    } catch (ex) {
        console.log('Sizzle error ')
        processPageDataCallback(ex.toString(), data);

    }
}

function updateScrapeMethod($, pageData, headers, scrapeData, scrape, options, updateScrapeMethodCallback) {
    var baseData = scrape._doc.data
    for (var field in scrapeData) {
        if (field == 'tags') {
            if (baseData.tags) {
                for (var j = 0; j < scrapeData.tags.length; j++) {
                    if (baseData.tags.indexOf(scrapeData.tags[j]) == -1) {
                        baseData.tags.push(scrapeData.tags[j])
                    }
                }
            } else {
                baseData[field] = scrapeData[field]
            }
        } else {
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
    /* scrape.save(function (err, scrapeSaveResult) {
     if (scrapeSaveResult) {
     console.log('Saved ' + scrapeSaveResult._id)
     }*/
    updateScrapeMethodCallback(err, $, pageData, headers, scrapeData, {})
    //})
}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
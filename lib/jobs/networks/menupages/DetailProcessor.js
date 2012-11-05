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

        data.hours = []
        container.find('dl.hours dd span.note').each(function (idx, elem) {
            var hours = $(elem).text();
            data.hours.push(hours.replace('\r'));
        })

        container.find('dl.serves dd.note').each(function (idx, elem) {
            var serves = $(elem).text();
            serves = serves.replace(/\r+/g, '');
            serves = serves.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ');
            data.goodformeal = serves.trim();
        })

        var featureMap = {
            'Group Dining':'groups',
            'Outdoor Dining':'outdoorseating',
            'Waterfront':'waterfront',
            'Delivery':'delivery',
            'Online Ordering':'onlineordering',
            'Accepts Credit Cards':'creditcards',
            'Lunch Special':'',
            'Take Out':'takeout',
            'Catering':'caters',
            'Private Parties':'privateparties',
            'Great Views':'goodviews'
        }
//
        data.features = [];
        container.find('dl.features dd.note').each(function (idx, elem) {
            var features = $(elem).text();
            features = features.replace(/\r+/g, '');
            features = features.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ');
            var fA = features.trim().split(',');
            for (var i = 0; i < fA.length; i++) {
                var feature = fA[i].trim();
                if (featureMap[feature]) {
                    data[featureMap[feature]] = true;
                } else {
                    data.features.push(feature);
                }
            }
        })

        container.find('dl.delivery-amount dd.note').each(function (idx, elem) {
            data.mindelivery = $(elem).text().trim();
            data.mindelivery = data.mindelivery.replace(/\r+/g, '');
            data.mindelivery = data.mindelivery.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ');
        })

        container.find('dl.website dd a.note').each(function (idx, elem) {
            data.website = $(elem).text();
        })

        data.reviews = [];
        container.find('ul#comments-list .hreview').each(function (idx, elem) {
            var review = {};
            $(elem).find('.reviewer').each(function (rIdx, rElem) {
                review.author = $(rElem).text();
            })
            $(elem).find('.dtreviewed').each(function (rIdx, rElem) {
                review.dtreviewed = $(rElem).text();
            })
            $(elem).find('.description').each(function (rIdx, rElem) {
                review.content = $(rElem).text();
            })
            $(elem).find('.summary').each(function (rIdx, rElem) {
                review.title = $(rElem).text();
            })
            data.reviews.push(review);
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
    scrape.save(function (err, scrapeSaveResult) {
        if (scrapeSaveResult) {
            console.log('Saved ' + scrapeSaveResult._id)
        }
        updateScrapeMethodCallback(err, $, pageData, headers, scrapeData, scrapeSaveResult)
    })
}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
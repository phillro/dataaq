function processPageData($, pageData, headers, processPageDataCallback) {
    var data = {}
    try {
        var container = $('#wrapper');

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
        data.reviews = [];
        container.find('#reviews .hReview').each(function (idx, elem) {
            var review = {};
            $(elem).find('.reviewer').each(function (rIdx, rElem) {
                review.author = $(rElem).text();//.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ').trim();
            })
            $(elem).find('.dtreviewed').each(function (rIdx, rElem) {
                review.dtreviewed = rElem.title;//.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ').trim();
            })

            review.content = '';
            $(elem).find('.review_text.description').each(function (rIdx, rElem) {
                review.content += $(rElem).text();
            })
            review.content = review.content.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ")
            $(elem).find('.description').each(function (rIdx, rElem) {
                review.content = $(rElem).text();//.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ').trim();
            })

            $(elem).find('span.rating').each(function (rIdx, rElem) {
                review.rating = $(rElem).text();//.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ').trim();
            })
            $(elem).find('.lrgFnt.review_title.summary em').each(function (rIdx, rElem) {
                review.title = $(rElem).text().replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ').trim();
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
        updateScrapeMethodCallback(undefined, $, pageData, headers, scrapeData, scrapeSaveResult)
    })
    //updateScrapeMethodCallback(undefined, $, pageData, headers, scrapeData, {})
}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
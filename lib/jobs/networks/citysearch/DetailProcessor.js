function processPageData($, pageData, headers, processPageDataCallback) {
    var data = {}
    try {
        var container = $('.restaurantsPage');
        container.find('.postal-code').each(function (idx, elem) {
            data.zip = $(elem).text();
        })

        container.find('.geo .latitude').each(function (idx, elem) {
            data.latitude = $(elem).text();
            try {
                data.latitude = parseFloat(data.latitude);
            } catch (ex) {
            }
        });

        container.find('.geo .longitude').each(function (idx, elem) {
            data.longitude = $(elem).text();
            try {
                data.longitude = parseFloat(data.longitude);
            } catch (ex) {
            }
        });

        if (data.latitude) {
            container.find('.coreInfo .tel').each(function (idx, elem) {
                data.phone = $(elem).text();
            })
        }

        var sideBlockMaps = {
            'Cuisine:':'cuisine',
            'Price:':'priceString',
            'Categories:':'tags'

        }
        /*container.find('.sideBySide.block').each(function(idx,elem){
         var fieldName=false;
         $(elem).find('.h5').each(function(rIdx,rElem){
         var fieldName = rElem.textContent;
         $(elem).find('dd span').each(function(tIdx,tElem){
         var n1 = $(tElem).text();
         var n2 = $(tElem).textContent;
         var t=3
         })
         })
         })*/

        data.reviews = [];
        container.find('.hreview').each(function (idx, elem) {
            var review = {};
            var id = elem.id;
            var rNum = id.split('.')[1];
            $(elem).find('#review\\.link\\.' + rNum + ' span').each(function (rIdx, rElem) {
                review.author = $(rElem).text();
            })

            $(elem).find('#review\\.date\\.' + rNum).each(function (rIdx, rElem) {
                review.dtreviewed = rElem.title;
            })

            review.content = '';

            $(elem).find('#review\\.title\\.' + rNum).each(function (rIdx, rElem) {
                review.content = $(rElem).text();
            })

            $(elem).find('#review\\.description\\.' + rNum).each(function (rIdx, rElem) {
                review.content += $(rElem).text();
            })
            review.content = review.content.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ');
            data.reviews.push(review);
        })

        container.find('#businessHoursContent .padded').each(function (idx, elem) {
            data.hours = $(elem).text().replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").trim();
        })

        container.find('.rating.scoreCard.scoreCardHigh .average').each(function (idx, elem) {
            data.ratingText = $(elem).text();
            try {
                data.rating = ((parseFloat(data.ratingText) / 100) * 5).toFixed(2)
            } catch (ex) {
            }
            var t = 1;
        })

        processPageDataCallback(undefined, data);
    } catch (ex) {
        console.log('Sizzle error ')
        processPageDataCallback(ex.toString(), data);

    }
}

function updateScrapeMethod($, pageData, headers, scrapeData, scrape, options, updateScrapeMethodCallback) {
    var baseData = scrape._doc.data||{}
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
    if (options.s3path) {
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
}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
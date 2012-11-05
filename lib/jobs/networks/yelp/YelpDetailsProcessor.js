/**
 * User: philliprosen
 * Date: 11/3/12
 * Time: 7:56 PM
 */



function processPageData($, pageData, headers, processPageDataCallback) {
    var data = {}
    try {
        var container = $('.container')
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
            'span[itemprop="streetAddress"]':'address',
            'span[itemprop="addressLocality"]':'city',
            'span[itemprop="addressRegion"]':'state',
            'span[itemprop="postalCode"]':'zip',
        }

        for (var f in textValueFields) {
            container.find(f).each(function (idx, elem) {
                data[textValueFields[f]] = $(elem).text();
                data[textValueFields[f]] = data[textValueFields[f]].trim();
            })
        }

        data.cuisine = []
        container.find('#cat_display a').each(function (idx, elem) {
            data.cuisine.push($(elem).text().replace('\n\t', ''));
        })

        container.find('#bizPhone').each(function (idx, elem) {
            data.phone = $(elem).text();
        })

        container.find('#bizUrl href').each(function (idx, elem) {
            data.website = $(elem).text();
        })
        container.find('#reviews-other').each(function (idx, reviewsBlock) {
            $(reviewsBlock).find('.review').each(function (rIdx, revBlock) {
                var review = {}
                $(revBlock).find('[itemprop="author"]').each(function (ratIdx, ratBlock) {
                    review.author = ratBlock.textContent;
                })

                $(revBlock).find('[itemprop="datePublished"]').each(function (ratIdx, ratBlock) {
                    review.dtreviewed = $(ratBlock).attr('content');
                })

                $(revBlock).find('[itemprop="description"]').each(function (ratIdx, ratBlock) {
                    review.content = ratBlock.textContent;
                })
                $(revBlock).find('[itemprop="ratingValue"]').each(function (ratIdx, ratBlock) {
                    review.rating = $(ratBlock).attr('content');
                })
                reviews.push(review)
            })
        })
        data.reviews = reviews;

        data.hours = [];
        container.find('.attr-BusinessHours .hours').each(function (idx, elem) {
            data.hours.push(elem.textContent);
        })

        var boolBizFields = {
            'attr-BusinessAcceptsCreditCards':'creditcards',
            'attr-RestaurantsDelivery':'delivery',
            'attr-RestaurantsGoodForGroups':'groups',
            'attr-GoodForKids':'kids',
            'attr-RestaurantsReservations':'reservations',
            'attr-RestaurantsTakeOut':'takeout',
            'attr-RestaurantsTableService':'tableservice',
            'attr-OutdoorSeating':'outdoorseating',
            'attr-WiFi':'wifi',
            'attr-HasTV':'tv',
            'attr-Caters':'caters',
            'attr-WheelchairAccessible':'wheelchair'
        }

        for (var f in boolBizFields) {
            try {
                container.find('dd.' + f).each(function (idx, elem) {
                    data[boolBizFields[f]] = elem.textContent.toLowerCase() == 'yes' ? true : false;
                })
            } catch (ex) {
            }
        }

        var valueBizFields = {
            'attr-transit':'transportation',
            'attr-RestaurantsAttire':'attire',
            'attr-BusinessParking':'parking',
            'attr-GoodForMeal':'goodformeal',
            'attr-Alcohol':'alchohol',
            'attr-Ambience':'ambience',
            'attr-NoiseLevel':'noiselevel'
        }

        for (var f in valueBizFields) {
            try {
                container.find('dd.' + f).each(function (idx, elem) {
                    data[valueBizFields[f]] = elem.textContent.replace(/(\r\n|\n|\r|\n\t|\t)/gm, " ").replace(/  +/g, ' ');
                })
            } catch (ex) {
            }
        }
        /*
         container.find('dd.attr-RestaurantsDelivery').each(function (idx, elem) {
         var delivery = elem.textContent;
         data.delivery = delivery.toLowerCase() == 'yes' ? true : false

         })*/
        /*
         var bizAttributes = {}
         try {
         container.find('#bizAdditionalInfo').each(function (idx, bizAddInfo) {
         $(bizAddInfo).find('dt').each(function (bIdx, infoDesc) {
         var attributeName = $(infoDesc).attr('class')
         var selectorName = 'dd.' + attributeName
         $(bizAddInfo).find(selectorName).each(function (bzIdx, infoValue) {
         data[attributeName.replace('attr-', '')] = infoValue.textContent
         .replace(/[^a-zA-Z 0-9]+/g, '')
         .replace(/  +/g, ' ')
         .trim()
         })
         })
         })
         } catch (ex) {
         console.log('parse error on #bizAdditionalInfo')
         }*/
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
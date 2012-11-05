var jsdom = require('jsdom')
    , jquery = require('jquery').toString(),
    MenuConverter = require('../../../MenuConverter');

function processPageData($, pageData, headers, processPageDataCallback) {
    var data = {}
    try {
        var container = $('#content-container')
        container.find('#restaurant-menu').each(function (aIdx, menuElem) {
            data.menuHtml = $(menuElem).html();
        })
        var menuContainer = $('#content-primary');
        var name = '';
        container.find('.title1respage').each(function (idx, elem) {
            name = $(elem).text();
        })
        var rawHtml = data.menuHtml.replace(/(\n|\t|\n\t|\n\t\t)/gm, "").replace(/\"/gm, "");
        jsdom.env({
            html:'<div id="container">' + rawHtml + '</div>',
            scripts:[
                'http://code.jquery.com/jquery-1.5.min.js'
            ],
            done:function (errors, window) {
                var $2 = window.$;
                var currentSection = false;
                var parentSection = new MenuConverter.MenuSection(name + ' Menu', '');
                $2('#container').children().each(function () {
                    if (this._nodeName == 'h3') {
                        currentSection = new MenuConverter.MenuSection($2(this).text(), '');
                    }
                    if (this._nodeName == 'p') {
                        currentSection.description = $2(this).text();
                    }
                    if (this._nodeName == 'table') {
                        $2(this).find('tr').each(function () {
                            var item = {};
                            $2(this).find('th').each(function () {
                                $2(this).children().each(function () {
                                    if (this._nodeName == 'cite') {
                                        item.name = $2(this).text().trim();
                                        $2(this).remove();
                                    }
                                })
                                $2(this).remove('cite');
                                item.description = $2(this).text().trim();
                            })
                            $2(this).find('td').each(function (idx, val) {
                                if (idx == 2) {
                                    item.price = $2(this).text().trim();
                                }
                            })
                            try {
                                currentSection.items.push(item);
                            } catch (ex) {
                            }
                        })
                        if (currentSection) {
                            parentSection.sections.push(currentSection);
                            currentSection = false;
                        }
                    }
                })
                data.menuJson = parentSection;
                data.ordrinMenu = parentSection.toOrdrinMenuNode();
                window.close();
                processPageDataCallback(undefined, data);
            }
        })
    }
    catch
        (ex) {
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
        updateScrapeMethodCallback(err, $, pageData, headers, scrapeData, {})
    })
}

exports.updateScrapeMethod = updateScrapeMethod;
exports.processingMethod = processPageData;
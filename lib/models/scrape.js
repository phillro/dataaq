var mongoose = require('mongoose')
var Schema = mongoose.Schema
var Types = mongoose.Types
    , ObjectId = Schema.ObjectId
    , Object = Schema.Object
var mongooseTypes = require("mongoose-types")
    , useTimestamps = mongooseTypes.useTimestamps;

var Scrape = new Schema({
    locationId:ObjectId,
    factual_id:String,
    data:{},
    rawHtml:String,
    menuParsed:Boolean,
    createCandidate:{type:Boolean, 'default':false},
    createCandidatePending:{type:Boolean, 'default':false},
    params:{},
    network:String,
    lastChecked:Date,
    lastPairCheck:Date,
    detailsReady:Boolean,
    quality:Number,
    type:String,
    //Used for events in case no locationId
    locationScrapeId:ObjectId,
    locationUrl:String,
    citiesTried:[
        {type:String}
    ],
    doesNotExist:Boolean,
    "updatedAt":{type:Date},
    "createdAt":{type:Date, "default":Date.now}
});


Scrape.pre('save', function (next) {
    this.updatedAt = new Date;
    next();
});

Scrape.statics.addIfNew = function (scrape, callback) {

    if (scrape.params.url) {
        this.findOne({'params.url':scrape.params.url}, function (err, result) {
            if (!result) {
                scrape.save(function (err, scrapeSaveResult) {
                    callback(err, scrapeSaveResult)
                })
            } else {
                callback(err, result)
            }
        })
    } else {
        callback('no params url provided')
    }

}

exports = Scrape;
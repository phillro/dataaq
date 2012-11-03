/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 6:35 PM
 */
var async = require('async'),
    nodeio = require('node.io'),
    InputQueue = require('../../../lib/InputQueue').InputQueue,
    ProxyQueue = require('../../../lib/ProxyQueue').ProxyQueue,
    JobQueue = require('../../../lib/JobQueue').JobQueue;

var defaultOptions = {
    take:1,
    max:1
}

var methods = {
    input:function (start, num, callback) {
        var jobQueue = new JobQueue('default', {redisClient:this.options.redisClient})
        jobQueue.getNext(function (err, job) {
            if (job) {
                callback([job]);
            } else {
                callback(false);
            }
        })
    },
    run:function (job) {
        var self = this;
        var jobFile = require('./' + job.network + '/' + job.type);
        var jobOptions = jobFile.options;
        var jobMethods = jobFile.methods;

        async.forEachSeries(job.input, function (inp, jobCb) {
            var scrapeJob = new nodeio.Job(jobOptions, jobMethods);
            if (typeof inp == 'string') {
                inp = [inp];
            }
            scrapeJob.input = function (start, num, inpFuncCb) {
                if (inp.length > 0) {
                    var param = [inp];
                    inp = false;
                    inpFuncCb(param)
                } else {
                    inpFuncCb(false)
                }
            }
            nodeio.start(scrapeJob, {redisClient:self.options.redisClient,mongooseLayer:self.options.mongooseLayer}, function (err, results) {
                if (err) {
                    console.log(err)
                }
                console.log('Completed job input for ' + job.uid);
                jobCb()
            })
        }, function (forEachError) {
            self.emit('Finished job ' + job.uid);
        });

    },
    fail:function(err,arg2){
        console.log('Fail called')
        console.log(err);
    },
    complete:function (callback) {
        callback()
    }

}

exports.options = defaultOptions;
exports.methods = methods;

/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 2:30 PM
 */
var async = require('async')
var nodeio = require('node.io');

function Executor(opts) {
    this.jobsRoot = opts.jobRoot;
}

Executor.exec = function (scrapeJob, cb) {
    var jobPath = this.jobsRoot;
    if (scrapeJob.network) {
        jobPath += scrapeJob.network;
    }
    jobPath += scrapeJob.type + '.js';

    var baseJob = require(jobPath);
    var nodeJob = new nodeio.Job(baseJob.options, baseJob.methods);
    var jobInput = scrapeJob.opts.input;
    nodeJob.input = function (start, num, inputCb) {
        if(jobInput.length>0){
            inputCb(jobInput.pop());
        }else{
            inputCb(false);
        }
    }


    nodeio.start(nodeJob, nodeJob.opts, function (err, results) {
        if (err) {
            console.log(err)
        } else {
            console.log(results)
        }
        console.log('Process '+scrapeJob.network+' '+scrapeJob.type+' Job Complete')
        cb();
    })
}

exports = Executor
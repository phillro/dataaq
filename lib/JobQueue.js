/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 2:30 PM
 */
var uuid = require('node-uuid');

var  JobQueue = function (name, opts) {
    this.queuename = 'scrapequeue:jobqueue:' + name;
    this.completeset = 'scrapequeue:complete:' + name;
    this.errorset = 'scrapequeue:error:' + name;
    this.processing = 'scrapequeue:processing:' + name;
    this.redisClient = opts.redisClient ? opts.redisClient : redis.createClient();
}
JobQueue.prototype.push = function(job, cb){
    var jobString = JSON.stringify(job);
    this.redisClient.lpush(this.queuename, jobString, cb);
}

JobQueue.prototype.getNext = function (cb) {
    var self = this;
    this.redisClient.rpop(this.queuename, function (err, jobString) {
        if(err){
            cb(err);
        }else{
            if(typeof jobString=='string'){
                try{
                    var job = JSON.parse(jobString)
                    cb(undefined, job);
                }catch(ex){
                    console.log(jobString)
                    cb(ex.toString());
                }
            }else{
                cb();
            }
        }
    });
}

JobQueue.prototype.setError = function (job, cb) {
    var jobString = JSON.stringify(job);
    if(typeof cb!=='function'){cb=function(){}}
    this.redisClient.zadd(this.errorset, job.ui, new Date().getTime(), jobString, cb);
}

JobQueue.prototype.setComplete = function (job, cb) {
    var self = this;
    var jobString = JSON.stringify(job);
    if(typeof cb!=='function'){cb=function(){}}
    this.redisClient.zrem(this.completeset, job.uid, function (err, res) {
        self.redisClient.zadd(job.ui, new Date().getTime(), jobString, cb);
    })

}

JobQueue.prototype.setProcessing = function (job, cb) {
    var self = this;
    var jobString = JSON.stringify(job);
    if(typeof cb!=='function'){cb=function(){}}
    this.redisClient.zrem(this.processing, job.uid, function (err, res) {
        this.redisClient.zadd(job.ui, new Date().getTime(), jobString, cb);
    })
}


var Job = function(network, type, opts, sourceUid){
    this.uid = uuid.v1();
    this.network = network;
    this.opts=opts;
    this.type=type;
    this.input=opts.input||[];
    this.sourceUid=sourceUid;
    this.count=0;

}


exports.Job = Job;
exports.JobQueue = JobQueue;
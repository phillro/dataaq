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
    return this;
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
            if(typeof job=='string'){
                try{
                    cb(undefined, JSON.parse(jobString));
                }catch(ex){
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
    this.redisClient.zadd(this.errorset, job.ui, new Date().getTime(), jobString, cb);
}

JobQueue.prototype.setComplete = function (job, cb) {
    var self = this;
    var jobString = JSON.stringify(job);
    this.redisClient.zrem(this.completeset, job.uid, function (err, res) {
        self.redisClient.zadd(job.ui, new Date().getTime(), jobString, cb);
    })

}

JobQueue.prototype.setProcessing = function (job, cb) {
    var self = this;
    var jobString = JSON.stringify(job);
    this.redisClient.zrem(this.processing, job.uid, function (err, res) {
        this.redisClient.zadd(job.ui, new Date().getTime(), jobString, cb);
    })
}


function Job(network, type, opts, sourceUid){
    this.uid = uuid.v1();
    this.network = network;
    this.opts=opts;
    this.type=type;
    this.input=[];
    this.sourceUid=sourceUid;
    return this;
}


exports.Job = Job;
exports.JobQueue = JobQueue;
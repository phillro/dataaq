/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 3:49 PM
 */



var InputQueue = function(name, opts) {
    this.queuename = 'inputqueue:' + name;
    this.redisClient = opts.redisClient ? opts.redisClient : redis.createClient();
}
InputQueue.prototype.push = function (inputString, cb) {
    this.redisClient.lpush(this.queuename, inputString, cb);
}

InputQueue.prototype.getNext = function (cb) {
    var self = this;
    this.redisClient.rpop(this.queuename, function (err, inputString) {
        cb(err,inputString);
    })
}



exports.InputQueue = InputQueue;
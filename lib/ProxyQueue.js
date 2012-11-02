/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 3:49 PM
 */



var ProxyQueue = function (name, opts) {
    this.queuename = 'proxyqueue:' + name;
    this.redisClient = opts.redisClient ? opts.redisClient : redis.createClient();
}
ProxyQueue.prototype.push = function (proxyString, cb) {
    this.redisClient.lpush(this.queuename, proxyString, cb);
}

ProxyQueue.prototype.getNext = function (cb) {
    var self = this;
    console.log(this.queuename);
    this.redisClient.rpop(this.queuename, function (err, proxyString) {
        if (err) {
            cb(err);
        } else {
            try {
                self.redisClient.lpush(self.queuename, proxyString, function(err,res){
                    cb(undefined,proxyString);
                });
            } catch (ex) {
                cb(ex.toString());
            }
        }
    })
}

ProxyQueue.prototype.add = function (proxyString, cb) {
    this.redisClient.lpush(this.queuename, proxyString, function (err, res) {
        cb(err, res);
    })
}

ProxyQueue.prototype.clear = function (cb) {
    this.redisClient.del(this.queuename, function (err, res) {
        cb(err, res);
    })
}

exports.ProxyQueue = ProxyQueue;
/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 3:49 PM
 */



var ProxyQueue = function (name, opts) {
    this.queuename = 'proxyqueue:' + name;
    this.redisClient = opts.redisClient ? opts.redisClient : redis.createClient();
    return this;
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
                self.redisClient.lpush(self.queuename, proxyString, cb);
            } catch (ex) {
                cb(ex.toString());
            }
        }
    })
}

exports.ProxyQueue = ProxyQueue;
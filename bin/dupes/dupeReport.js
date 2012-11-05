function mapSum() {
    emit(1, // Or put a GROUP BY key here
        {
            sum:this.dupe_ids_count,
            min:this.dupe_ids_count,
            max:this.dupe_ids_count,
            count:1,
            diff:0 // M2,n:  sum((val-mean)^2)
        });
}

function reduceSum(key, values) {
    var a = values[0]; // will reduce into here
    for (var i = 1/*!*/; i < values.length; i++) {
        var b = values[i]; // will merge 'b' into 'a'
        var delta = a.sum / a.count - b.sum / b.count; // a.mean - b.mean
        var weight = (a.count * b.count) / (a.count + b.count);
        a.diff += b.diff + delta * delta * weight;
        a.sum += b.sum;
        a.count += b.count;
        a.min = Math.min(a.min, b.min);
        a.max = Math.max(a.max, b.max);
    }
    return a;
}

function finalizeSum(key, value) {
    value.avg = value.sum / value.count;
    value.variance = value.diff / value.count;
    value.stddev = Math.sqrt(value.variance);
    return value;
}

db.amex_venues.mapReduce(mapSum, reduceSum, {finalize:finalizeSum, out:{ inline:1}});
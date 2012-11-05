/**
 * User: philliprosen
 * Date: 10/15/12
 * Time: 5:08 PM
 */

var natural = require('natural');

exports.stem = function (words) {
    var ret = [];
    for (var i = 0, len = words.length; i < len; ++i) {
        ret.push(natural.PorterStemmer.stem(words[i]));
    }
    return ret;
};

exports.metaphoneArray = function (words) {
    var arr = []
        , constant;
    for (var i = 0, len = words.length; i < len; ++i) {
        constant = natural.Metaphone.process(words[i]);
        if (!~arr.indexOf(constant)) {
            arr.push(constant);
        }
    }
    return arr;
};

exports.stripStopWords = function (words, stopwords) {
    var ret = [];
    for (var i = 0, len = words.length; i < len; ++i) {
        var word = words[i].toString();
        if (stopwords.indexOf(word.toLowerCase())>-1) {
            continue;
        }
        if (words[i].trim().length > 0) {
            ret.push(words[i]);
        }
    }
    return ret;
};

exports.countWords = function (words) {
    var obj = {};
    for (var i = 0, len = words.length; i < len; ++i) {
        obj[words[i]] = (obj[words[i]] || 0) + 1;
    }
    return obj;
};

exports.metaphoneMap = function (words) {
    var obj = {};
    for (var i = 0, len = words.length; i < len; ++i) {
        obj[words[i]] = natural.Metaphone.process(words[i]);
    }
    return obj;
};

exports.words = function (str) {
    return String(str).trim().split(/\W+/);
};
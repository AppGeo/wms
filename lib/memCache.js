'use strict';
var Cache = require('lru-cache');

var lru = new Cache({
  max: 20 * 1024 * 1024,
  length: function (item) {
    return item.length;
  }
});

exports.get = get;
function get (key, callback) {
  var item = lru.get(key);
  if (Buffer.isBuffer(item)) {
    return process.nextTick(callback, null, item);
  }
  process.nextTick(callback, new Error('not found'));
}

exports.set = set;

function set(key, value, callback) {
  if (!Buffer.isBuffer(value)) {
    value = new Buffer(value);
  }
  lru.set(key, value);
  process.nextTick(callback);
}

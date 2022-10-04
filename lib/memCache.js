'use strict';
var Cache = require('lru-cache');

var lru = new Cache({
  maxSize: 20 * 1024 * 1024,
  sizeCalculation: function (item) {
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
exports.getAsync = getAsync;
async function getAsync (key) {
  var item = lru.get(key);
  if (Buffer.isBuffer(item)) {
    return item;
  }
  throw new Error('not found');
}
exports.set = set;

function set(key, value, callback) {
  if (!Buffer.isBuffer(value)) {
    value = Buffer.from(value);
  }
  lru.set(key, value);
  process.nextTick(callback);
}

exports.setAsync = setAsync;
async function setAsync(key, value) {
  if (!Buffer.isBuffer(value)) {
    value = Buffer.from(value);
  }
  lru.set(key, value);
}

'use strict';
var Promise = require('bluebird');

Promise.coroutine.addYieldHandler(function(v) {
  return Promise.resolve(v);
});

module.exports = Promise;

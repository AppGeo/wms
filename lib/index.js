'use strict';
var normalizeObj = require('./normalizeObj');
var Promise = require('./promise');
module.exports = exports = wms;
exports.getCapabilities = require('./capabilities');
exports.getTile = require('./tile');
exports.getMap = require('./map');

function wms(options, rawParams, cache, callback) {
  var params = normalizeObj(rawParams);
  if (typeof params.request !== 'string') {
    return Promise.resolve({
      code: 400,
      data: 'unknown/invalid request'
    }).asCallback(callback);
  }
  switch (params.request.toLowerCase()) {
    case 'getcapabilities':
      return exports.getCapabilities(options, params, cache, callback);
    case 'getmap':
      return exports.getMap(options, params, cache, callback);
    case 'gettile':
      return exports.getTile(options, params, cache, callback);
    default:
      return Promise.resolve({
        code: 400,
        data: 'unknown/invalid request'
      }).asCallback(callback);
  }
}

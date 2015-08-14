'use strict';
var normalizeObj = require('./normalizeObj');

module.exports = exports = wms;
exports.getCapabilities = require('./capabilities');
exports.getTile = require('./tile');
exports.getMap = require('./map');

function wms (options, rawParams, callback) {
  var params = normalizeObj(rawParams);
  switch(params.request.toLowerCase()) {
    case 'getcapabilities':
      return exports.getCapabilities(options, params, callback);
    case 'getmap':
      return exports.getMap(options, params, callback);
    case 'gettile':
      return exports.getTile(options, params, callback);
    default:
      throw new Error('unknown/invalid request');
  }
}

'use strict';
var normalizeObj = require('./normalizeObj');
module.exports = exports = wms;
exports.getCapabilities = require('./capabilities');
exports.getTile = require('./tile');
exports.getMap = require('./map');
const invalid = (callback)=>{
  if (!callback) {
    return Promise.resolve({
      code: 400,
      data: 'unknown/invalid request'
    })
  }
  process.nextTick(()=>{
    callback(null, {
      code: 400,
      data: 'unknown/invalid request'
    })
  });
}
function wms(options, rawParams, cache, callback) {
  var params = normalizeObj(rawParams);
  if (typeof params.request !== 'string') {
    return invalid(callback);
  }
  switch (params.request.toLowerCase()) {
    case 'getcapabilities':
      return exports.getCapabilities(options, params, cache, callback);
    case 'getmap':
      return exports.getMap(options, params, cache, callback);
    case 'gettile':
      return exports.getTile(options, params, cache, callback);
    default:
      if (callback) {
        process.nextTick(()=>{

        })
      }
      return invalid(callback);
  }
}

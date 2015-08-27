'use strict';
var Promise = require('./promise');
var checkTile = require('./checkTile');
var getEtag = require('./getEtag');
var makeError = require('./makeError');
var mime = require('mime');
var mapnik = require('mapnik');
var normalizeObj = require('./normalizeObj');
var find = require('./find');
var makeUnknownError = require('./makeUnknownError');
var getTile = Promise.coroutine(_getTile);
var defaultCache = Promise.promisifyAll(require('./memCache'));
var crypto = require('crypto');
var transCode = Promise.coroutine(_transCode);
module.exports = function (layer, params, cache, callback) {
  if (typeof cache === 'function') {
    callback = cache;
    cache = undefined;
  }
  if (typeof cache === 'undefined') {
    cache = defaultCache;
  } else {
    cache = Promise.promisifyAll(cache);
  }
  return getTile(layer, params, cache).nodeify(callback);
};
var requiredParams = [
  'layer',
  'tilematrix',
  'tilerow',
  'tilecol',
  'format'
];
function * _getTile(layer, rawParams, cache) {
  try {
    layer = yield layer;
  } catch (e) {
    return makeUnknownError(e);
  }
  if (!layer) {
    throw new TypeError('must include layer function');
  }
  var params = normalizeObj(rawParams);
  var i = -1;
  var len = requiredParams.length;
  var param;
  while (++i < len) {
    param = requiredParams[i];
    if(!params[param]) {
      return makeError(`missing required parameter: ${param}`, 'MissingParameterValue', param);
    }
  }
  layer = find(layer, params.layer);
  if (!layer) {
    return makeError(`No such layer: ${params.layer}`, 'InvalidParameterValue', 'LAYER');
  }
  if (layer.viewable === false) {
    return {
      headers: {},
      data: new Buffer('not authorized'),
      code: 401
    };
  }
  var desiredFormat = mime.extension(params.format);
  if (!desiredFormat) {
    return makeError(`Invalid paramter value for FORMAT: ${params.format}`, 'InvalidParameterValue', 'FORMAT');
  }
  var z;
  if (params.tilematrix.indexOf(':') > -1) {
    z = parseInt(params.tilematrix.split(':')[1], 10);
  } else {
    z = parseInt(params.tilematrix, 10);
  }
  var y = parseInt(params.tilerow, 10);
  var x = parseInt(params.tilecol, 10);
  var paramError = checkXYZ(z, params.tilematrix, 'TILEMATRIX') ||
    checkXYZ(y, params.tilerow, 'TILEROW') ||
    checkXYZ(x, params.tilecol, 'TILECOL');
  if (paramError) {
    return paramError;
  }
  var tileError = checkTile(layer, x, y, z);
  if (tileError) {
    return makeError(`${tileError} is out of range`, 'TileOutOfRange', tileError);
  }
  var getTileFun = Promise.promisify(layer.getTile);
  var tile;
  try {
    tile = yield getTileFun(z, x, y);
  } catch(e) {
    var err = makeUnknownError(`tile not found`);
    err.code = 404;
    return err;
  }
  try {
    var data = tile[0];
    if (typeof data === 'string') {
      data = new Buffer(data, 'utf8');
    }
    var headers = normalizeObj(tile[1]);
    var returnedFormat = mime.extension(headers['content-type']);
    if (returnedFormat === desiredFormat) {
      if (!headers['content-length']) {
        headers['content-length'] = data.length;
      }
      if (!headers.etag) {
        headers.etag = getEtag(data);
      }
      return {
          data: data,
          headers: headers,
          code: 200
      };
    }
    var transcodedData = yield transCode(data, desiredFormat, cache);
    headers['content-type'] = mime.lookup(desiredFormat);
    headers['content-length'] = transcodedData.length;
    headers.etag = getEtag(data);
    return {
      data: transcodedData,
      headers: headers,
      code: 200
    };
  } catch (e) {
    return makeUnknownError(e);
  }
}
var fromBytes = Promise.promisify(mapnik.Image.fromBytes, mapnik.Image);
function encode(image, format) {
  if (!image || typeof image.encode !== 'function') {
    return Promise.reject(new TypeError('invalid image object'));
  }
  return new Promise(function (resolve, reject) {
    image.encode(format, function (err, resp) {
      if (err) {
        return reject(err);
      }
      return resolve(resp);
    });
  });
}
function * _transCode(tile, desiredFormat, cache) {
  var key = crypto.createHash('sha224').update(tile).update(desiredFormat).digest('base64');
  try {
    var result = yield cache.getAsync(key);
    console.log('cache hit');
    return result;
  } catch(_){}
  console.log('cache miss');
  var image = yield fromBytes(tile);
  var encoded = yield encode(image, desiredFormat);
  yield cache.setAsync(key, encoded);
  console.log('inserted');
  return encoded;
}

function checkXYZ(value, orig, name) {
  if (value !== value) {
    return makeError(`Invalid paramter value for ${name}: ${orig}`, 'InvalidParameterValue', name);
  }
}

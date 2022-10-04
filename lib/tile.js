'use strict';
var checkTile = require('./checkTile');
const util = require('util');
var getEtag = require('./getEtag');
var makeError = require('./makeError');
var mime = require('mime');
var mapnik = require('mapnik');
var normalizeObj = require('./normalizeObj');
var find = require('./find');
var makeUnknownError = require('./makeUnknownError');
const defaultCache = require('./memCache');
var crypto = require('crypto');
var EE = require('events').EventEmitter;
var imageType = require('./image-type');
const getTileCallback = util.callbackify(getTile);
const promisifyAll = (obj) => {
  obj.getAsync = util.promisify(obj.get).bind(obj);
  obj.setAsync = util.promisify(obj.set).bind(obj);
}

module.exports = function(layer, params, cache, callback) {
  if (typeof cache === 'function') {
    callback = cache;
    cache = undefined;
  }
  if (typeof cache === 'undefined') {
    cache = defaultCache;
  } else {
    cache = promisifyAll(cache);
  }
  if (callback) {
    return getTileCallback(layer, params, cache, callback)
  }
  return getTile(layer, params, cache);
};
var requiredParams = [
  'layer',
  'tilematrix',
  'tilerow',
  'tilecol',
  'format'
];

async function getTile(layer, rawParams, cache) {
  try {
    layer = await layer;
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
    if (!params[param]) {
      return makeError(`missing required parameter: ${param}`, 'MissingParameterValue', param);
    }
  }
  var abort = layer.abort;
  layer = find(layer, params.layer);
  if (!layer) {
    return makeError(`No such layer: ${params.layer}`, 'InvalidParameterValue', 'LAYER');
  }
  if (layer.viewable === false) {
    return {
      headers: {},
      data: Buffer.from('not authorized'),
      code: 401
    };
  }
  layer.abort = abort || new EE();
  var desiredFormat = mime.getExtension(params.format);
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
  var getTileFun = (z, x, y) => new Promise((success, failure) => {
    var ret = layer.getTile(z, x, y, function(err, tile, headers) {
      layer.abort.removeListener('abort', abortReq);
      if (err) {
        return failure(err);
      }
      return success([tile, headers]);
    });
    layer.abort.on('abort', abortReq);

    function abortReq() {
      ret.abort();
      failure(new Error('aborted'));
    }
  });
  var tile;
  try {
    tile = await getTileFun(z, x, y);
  } catch (e) {
    var err = makeUnknownError('tile not found');
    err.code = 404;
    return err;
  }
  try {
    var data = tile[0];
    if (typeof data === 'string') {
      data = Buffer.from(data, 'utf8');
    }

    var headers = normalizeObj(tile[1]);
    headers['content-type'] = imageType(data);
    var returnedFormat = mime.getExtension(headers['content-type']);
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
    var transcodedData = await transCode(data, desiredFormat, cache, layer.abort);
    headers['content-type'] = mime.getType(desiredFormat);
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
var fromBytes = util.promisify(mapnik.Image.fromBytes, mapnik.Image);

function encode(image, format) {
  if (!image || typeof image.encode !== 'function') {
    return Promise.reject(new TypeError('invalid image object'));
  }
  return new Promise(function(resolve, reject) {
    image.encode(format, function(err, resp) {
      if (err) {
        return reject(err);
      }
      return resolve(resp);
    });
  });
}

async function transCode(tile, desiredFormat, cache, abort) {
  var key = crypto.createHash('sha224').update(tile).update(desiredFormat).digest('base64');
  try {
    return await cache.getAsync(key);
  } catch (_) {
    // pass
  }
  if (abort.aborted) {
    throw new Error('aborted');
  }
  var image = await fromBytes(tile);
  if (abort.aborted) {
    throw new Error('aborted');
  }
  var encoded = await encode(image, desiredFormat);
  if (abort.aborted) {
    throw new Error('aborted');
  }
  await cache.setAsync(key, encoded);
  return encoded;
}

function checkXYZ(value, orig, name) {
  if (value !== value) {
    return makeError(`Invalid paramter value for ${name}: ${orig}`, 'InvalidParameterValue', name);
  }
}

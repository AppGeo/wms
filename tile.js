'use strict';
var Promise = require('./promise');
var checkTile = require('./checkTile');
var getEtag = require('./getEtag');
var makeError = require('./makeError');
var mime = require('mime');
var mapnik = require('mapnik');
var normalizeObj = require('./normalizeObj');
var makeUnknownError = require('./makeUnknownError');
module.exports = function (layer, params, callback) {
  return Promise.coroutine(getTile(layer, params)).nodify(callback);
};
var requiredParams = [
  'layer',
  'tilematrix',
  'tilerow',
  'tilecol',
  'format'
];
function * getTile(layer, rawParams) {
  if (!layer) {
    throw new TypeError('must include getTile function');
  }
  if (typeof layer.getTile !== 'function') {
    throw new TypeError('must include getTile function');
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
  var desiredFormat = mime.extension(param.format);
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
  try {
    var tile = yield getTileFun(x, y, z);
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
    var transcodedData = yield transCode(data, desiredFormat);
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
function transCode(tile, desiredFormat) {
  return fromBytes(tile).then(function (image){
    return encode(image, desiredFormat);
  });
}

function checkXYZ(value, orig, name) {
  if (value !== value) {
    return makeError(`Invalid paramter value for ${name}: ${orig}`, 'InvalidParameterValue', name);
  }
}

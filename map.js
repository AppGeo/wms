'use strict';

var Promise = require('./promise');
var normalizeObj = require('./normalizeObj');
var makeError = require('./makeError');
var checkTile = require('./checkTile');
var merc = require('./merc');
var mime = require('mime');
var gm = require('gm');
var makeUnknownError = require('./makeUnknownError');
var abaculus = Promise.promisify(require('abaculus'));
var getEtag = require('./getEtag');
var requiredParams = [
  'layers',
  'bbox',
  'width',
  'height',
  'format',
  'srs'
];
function resize(image, format, width, height) {
  return new Promise(function (resolve, reject) {
    gm(image, 'image.' + format).resize(width, height, '!').toBuffer(format, function (err, image) {
      if (err) {
        return reject(err);
      }
      resolve(image);
    });
  });
}
module.exports = function (layer, params, callback) {
  return Promise.coroutine(getMap(layer, params)).nodify(callback);
};

function * getMap(layer, rawParams) {
  if (!layer) {
    throw new TypeError('must include getTile function');
  }
  var params = normalizeObj(rawParams);
  var i = -1;
  var len = requiredParams.length;
  var param;
  if (params.crs && !params.srs) {
    params.srs = params.crs;
  }
  while (++i < len) {
    param = requiredParams[i];
    if(!params[param]) {
      return makeError(`missing required parameter: ${param}`, 'MissingParameterValue', param);
    }
  }
  var srs = params.srs || params.crs;
  srs = srs.toLowerCase();
  if (['epsg:900913', 'epsg:3857', 'epsg:4326'].indexOf(srs) === -1) {
    return makeError(`invalid srs: ${srs}`, 'InvalidSRS');
  }
  var scale;
  if (params.dpi || params.map_resolution) {
    scale = Math.round(72 / parseInt(params.dpi || params.map_resolution, 10)) || 1;
  } else {
    scale = 1;
  }
  if (scale !== scale) {
    scale = 1;
  }
  if (Array.isArray(layer)) {
    layer = layer[0];
    // only one for now
  }
  if (params.layers.indexOf(',') > -1) {
    return makeError('only one layer quariable at the moment', 'LayerNotDefined');
  }
  if (typeof layer.getTile !== 'function') {
    throw new TypeError('must include getTile function');
  }
  var bbox = params.bbox.split(',').map(function (num) {
    return parseFloat(num);
  });
  if (['epsg:900913', 'epsg:3857'].indexOf(srs) > -1) {
    bbox = merc.inverse([bbox[0], bbox[1]]).concat(merc.inverse([bbox[2], bbox[3]]));
  }
  var width = parseInt(params.width, 10);
  var height = parseInt(params.height, 10);
  var zoom = getZoom(bbox, [width, height], layer.range[0], layer.range[1]);
  var format = mime.extension(params.format);
  var bgcolor = params.bgcolor || '0xffffff';
  bgcolor = bgcolor.toLowerCase();
  if (params.transparent.toLowerCase() === 'true' && format === 'png') {
    bgcolor = false;
  }
  var opts = {
      scale: scale,
      zoom: zoom,
      bbox: bbox,
      getTile: makeGetTile(layer, bgcolor, format),
      format: format
    };
  try {
    var image = yield abaculus(opts);
    var resizedImage = yield resize(image, format, width, height);
    var headers = {
      'content-type':  mime.lookup(format),
      'content-length': resizedImage.length,
      etag: getEtag(resizedImage)
    };
    return {
      data: resizedImage,
      headers: headers,
      code: 200
    };
  } catch (e) {
    return makeUnknownError(e);
  }
}
function getZoom(bounds, dimensions, minzoom, maxzoom) {
  minzoom = (minzoom === undefined) ? 0 : minzoom;
  maxzoom = (maxzoom === undefined) ? 20 : maxzoom;


  var bl = merc.px([bounds[0], bounds[1]], maxzoom);
  var tr = merc.px([bounds[2], bounds[3]], maxzoom);
  var width = tr[0] - bl[0];
  var height = bl[1] - tr[1];
  var ratios = [width / dimensions[0], height / dimensions[1]];
  var adjusted = Math.ceil(Math.min(
          maxzoom - (Math.log(ratios[0]) / Math.log(2)),
          maxzoom - (Math.log(ratios[1]) / Math.log(2))));
  return Math.max(minzoom, Math.min(maxzoom, adjusted));

}
var blankPNG = new Buffer('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABmJLR0QA/wD/AP+gvaeTAAABFUlEQVR42u3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBPAAB2ClDBAAAAABJRU5ErkJggg==', 'base64');
var blanks = new Map();
function callBlankBack(tile, format, callback){
  var headers = {

  };
  headers['content-type'] = mime.lookup(format);
  headers['content-length'] = tile.length;
  callback(null, tile, headers);
}
function sendBlank(bgcolor, format, callback) {
  if (bgcolor === false) {
    return callBlankBack(blankPNG, format, callback);
  }
  if (bgcolor.slice(0, 2) === '0x') {
    bgcolor = bgcolor.slice(2);
  }
  if (bgcolor.length === 3) {
    bgcolor = bgcolor[0] + bgcolor[0] + bgcolor[1] + bgcolor[1] + bgcolor[2] + bgcolor[2];
  }
  if (bgcolor.length !== 6) {
    bgcolor = 'ffffff';
  }
  var key = bgcolor + format;
  if (blanks.has(key)) {
    return callBlankBack(blanks.get(key), format, callback);
  }
  gm(256, 256, '#' + bgcolor).toBuffer(format, function (err, image) {
    if (err) {
      return callback(err);
    }
    if (!blanks.has(key)) {
      blanks.set(key, image);
    }
    callBlankBack(image, format, callback);
  });
}
function makeGetTile(layer, bgcolor, format) {
  return getTile;
  function getTile(z, x, y, callback) {
    if (checkTile(layer, z, x, y)) {
      return sendBlank(bgcolor, format, callback);
    }
    layer.getTile(z, x, y, function (err, tile, headers) {
      if (err) {
        return sendBlank(bgcolor, format, callback);
      }
      callback(null, tile, headers);
    });
  }
}

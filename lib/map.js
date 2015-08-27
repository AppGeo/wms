'use strict';

var Promise = require('./promise');
var normalizeObj = require('./normalizeObj');
var makeError = require('./makeError');
var checkTile = require('./checkTile');
var merc = require('./merc');
var mime = require('mime');
var gm = require('gm');
var blend = require('mapnik').blend;
var defaultCache = require('./memCache');

var makeUnknownError = require('./makeUnknownError');
var abaculus = Promise.promisify(require('abaculus'));
var getEtag = require('./getEtag');
var find = require('./find');
var requiredParams = [
  'layers',
  'bbox',
  'width',
  'height',
  'format',
  'srs'
];
function resize(image, format, width, height) {
  image = Array.isArray(image) ? image[0] : image;
  return new Promise(function (resolve, reject) {
    gm(image, 'image.' + format).resize(width, height, '!').toBuffer(format, function (err, image) {
      if (err) {
        console.log(err);
        return reject(err);
      }
      resolve(image);
    });
  });
}


var getMap = Promise.coroutine(function * getMap(layer, rawParams) {
  try {
    layer = yield layer;
  } catch (e) {
    return makeUnknownError(e);
  }
  if (!layer) {
    throw new TypeError('must include layer');
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
  var format = mime.extension(params.format);
  var bgcolor = params.bgcolor || '0xffffff';
  bgcolor = bgcolor.toLowerCase();
  if (params.transparent.toLowerCase() === 'true' && format === 'png') {
    bgcolor = false;
  }
  layer = makeLayer(layer, params.layers, bgcolor, format);
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
      'content-type': mime.lookup(format),
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
});
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
module.exports = function (layer, params, cache, callback) {
  if (typeof cache === 'function') {
    callback = cache;
    cache = undefined;
  }
  if (typeof cache === 'undefined') {
    cache = defaultCache;
  }
  return getMap(layer, params, cache).nodeify(callback);
};
var blankPNG = new Buffer('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABmJLR0QA/wD/AP+gvaeTAAABFUlEQVR42u3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBPAAB2ClDBAAAAABJRU5ErkJggg==', 'base64');
var blanks = new Map();
function callBlankBack(tile, format, callback){
  var headers = {
     'content-type': mime.lookup(format),
     'content-length': tile.length
  };
  callback(null, tile, headers);
}
function sendBlank(bgcolor, format, callback) {
  if (!format) {
    return callback(new Error('not found'));
  }
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
    if (checkTile(layer, x, y, z)) {
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
function makeLayer(layerArray, layerParam, bgcolor, format) {
  if (layerParam.indexOf(',') === -1) {
    return find(layerArray, layerParam);
  }
  var layers = layerParam.split(',');
  var layerObjects = layers.map(function (item) {
    return find(layerArray, item);
  });
  if (layerObjects.some(function (layer) {
    return !layer || layer.viewable === false;
  })) {
    return false;
  }
  return layerObjects.reduce(function (acc, item) {
    acc.range = [Math.min(acc.range[0], item.range[0]), Math.max(acc.range[1], item.range[1])];
    acc.bbox = [Math.min(acc.bbox[0], item.bbox[0]), Math.min(acc.bbox[1], item.bbox[1]),
    Math.max(acc.bbox[2], item.bbox[2]), Math.max(acc.bbox[3], item.bbox[3])];
    return acc;
  }, {
    range: [Infinity, -Infinity],
    bbox: [Infinity, Infinity, -Infinity, -Infinity],
    getTile: makeGetTiles(layerObjects, bgcolor, format)
  });
}
var getFuncMap = new WeakMap();
function makeGetTiles(layerObjects, bgcolor, format) {
  return getTile;
  function getTile(z, x, y, callback) {
    var mapping = layerObjects.map(function(layer){
      return new Promise(function (resolve) {
        var getTile;
        if (getFuncMap.has(layer)) {
          getTile = getFuncMap.get(layer);
        } else {
          getTile = makeGetTile(layer);
          getFuncMap.set(layer, getTile);
        }
        getTile(z, x, y, function (err, tile, headers) {
            if (err) {
              return resolve();
            }
            resolve({
              tile: tile,
              headers: headers
            });
          });
      });
    });
    Promise.all(mapping).then(function (things) {
      var filtered = things.filter(function (item) {
        return item;
      });
      if (!filtered.length) {
        return sendBlank(bgcolor, format, callback);
      }
      blend(filtered.map(function (item) {
                return item.tile;
              }), {
                format: 'png',
                width: 256,
                height: 256}, function (err, resp) {
                  if (err) {
                    return sendBlank(bgcolor, format, callback);
                  }

                  var headers = {
                    etag: getEtag(resp),
                    'Content-Type': 'image/png'
                  };
                  callback(null, resp, headers);
                });
    });
  }
}

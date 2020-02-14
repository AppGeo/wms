'use strict';
var Promise = require('./promise');
var defaultCache = Promise.promisifyAll(require('./memCache'));
var normalizeObj = require('./normalizeObj');
var makeError = require('./makeError');
var EE = require('events').EventEmitter;
var merc = require('./merc');
var find = require('./find');
var requiredParams = [
  'layers',
  'bbox',
  'width',
  'height',
  'format',
  'srs',
  'query_layers',
  'info_format',
  'i',
  'j'
];
var makeUnknownError = require('./makeUnknownError');

module.exports = function(layer, params, cache, callback) {
  if (typeof cache === 'function') {
    callback = cache;
    cache = undefined;
  }
  if (typeof cache === 'undefined') {
    cache = defaultCache;
  } else {
    cache = Promise.promisifyAll(cache);
  }
  return Promise.resolve(getInfo(layer, params, cache)).asCallback(callback);
};

async function getInfo(layer, rawParams) {
  try {
    layer = await layer;
  } catch (e) {
    return makeUnknownError(e);
  }
  if (!layer) {
    throw new TypeError('must include layer');
  }
  var params = normalizeObj(rawParams);
  if (params.crs && !params.srs) {
    params.srs = params.crs;
  }
  for (const param of requiredParams) {
    if (!params[param]) {
      return makeError(`missing required parameter: ${param}`, 'MissingParameterValue', param);
    }
  }
  var srs = params.srs || params.crs;
  srs = srs.toLowerCase();
  if (['epsg:900913', 'epsg:3857', 'epsg:4326'].indexOf(srs) === -1) {
    return makeError(`invalid srs: ${srs}`, 'InvalidSRS');
  }

  var abort = layer.abort || new EE();
  try {
    layer = makeLayer(layer, params.query_layers,  abort);
  } catch (e) {
    if (e.layerLengthError) {
      return makeError(e.message, 'InvalidParameterValue', 'LAYER');
    }
    return makeError(e.message);
  }
  if (!layer) {
    return makeError(`No such layer: ${params.query_layers}`, 'InvalidParameterValue', 'LAYER');
  }
  if (layer.viewable === false) {
    return {
      headers: {},
      data: new Buffer('not authorized'),
      code: 401
    };
  }
  if (typeof layer.getInfo !== 'function') {
    throw new TypeError('must include getInfo function');
  }
  var width = parseInt(params.width, 10);
  if (width < 1) {
    return makeError('width must be greater than 0', 'InvalidParameterValue', 'WIDTH');
  }
  var height = parseInt(params.height, 10);
  if (height < 1) {
    return makeError('height must be greater than 1', 'InvalidParameterValue', 'HEIGHT');
  }
  var i = parseInt(params.i, 10);
  if (i < 1) {
    return makeError('i must be greater than 0', 'InvalidParameterValue', 'I ');
  }
  if (i >= width) {
    return makeError('i must be less than width - 1', 'InvalidParameterValue', 'I ');
  }
  var j = parseInt(params.j, 10);
  if (j < 1) {
    return makeError('j must be greater than 0', 'InvalidParameterValue', 'J ');
  }
  if (j >= height) {
    return makeError('j must be less than height - 1', 'InvalidParameterValue', 'J ');
  }
  var bbox = params.bbox.split(',').map(function(num) {
    return parseFloat(num);
  });
  if (['epsg:900913', 'epsg:3857'].indexOf(srs) > -1) {
    bbox = merc.inverse([bbox[0], bbox[1]]).concat(merc.inverse([bbox[2], bbox[3]]));
  }
  var queryArea = calcBox(bbox, width, height, i, j);
}
async function makeLayer(layerArray, layerParam) {
  if (layerParam.indexOf(',') === -1) {
    return find(layerArray, layerParam);
  }
  var layers = layerParam.split(',');
  if (typeof layerArray.layerLimit === 'number' && layers.length > layerArray.layerLimit) {
    var e = new Error(`LayerLimit is ${layerArray.layerLimit} but ${layers.length} layers were requested`);
    e.layerLengthError = true;
    throw e;
  }
  var layerObjects = layers.map(function(item) {
    return find(layerArray, item);
  });
  if (layerObjects.some(function(layer) {
    return !layer || layer.viewable === false || !layer.getInfo;
  })) {
    return false;
  }
  return layerObjects.reduce(function(acc, item) {
    acc.range = [Math.min(acc.range[0], item.range[0]), Math.max(acc.range[1], item.range[1])];
    acc.bbox = [Math.min(acc.bbox[0], item.bbox[0]), Math.min(acc.bbox[1], item.bbox[1]),
      Math.max(acc.bbox[2], item.bbox[2]), Math.max(acc.bbox[3], item.bbox[3])
    ];
    return acc;
  }, {
    range: [Infinity, -Infinity],
    bbox: [Infinity, Infinity, -Infinity, -Infinity],
    getInfo: makeGetInfo(layerObjects)
  });
}


function makeGetInfo(layerObjects) {
  return getInfo;
  async function getInfo(...args) {
    const out = await Promise.all(layerObjects.map(layer => new Promise((yes, no) => {
      layer.getInfo(...args, (err, resp) => {
        if (err) {
          return no(err);
        }
        yes({
          name: layer.name,
          info: resp
        })
      })
    })))
    return out.reduce((acc, item) => {
      acc[item.name] = item.info
    }, {});
  }
}

function calcBox([xmin, ymin, xmax, ymax], width, height, i, j) {
  const xrange = calcRange(xmin, xmax, width, i);
  const yrange = calcRange(ymin, ymax, height, j);
  return [xrange[0], yrange[0], xrange[1], yrange[1]];
}

function calcRange(coordMin, coordMax, interval, point) {
  var coordRange = coordMax - coordMin;
  var unit = coordRange/interval;
  var min = coordMin + (point * unit);
  var max = min + unit;
  return [min, max]
}

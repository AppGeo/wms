'use strict';
var Promise = require('./promise');
var fs = Promise.promisifyAll(require('fs'));
var handlebars = require('handlebars');
var path = require('path');
var getEtag = require('./getEtag');
var wms = fs.readFileAsync(path.join(__dirname, '../templates/wms.hbs')).then(function (template) {
  return handlebars.compile(template.toString());
});
var wmts = fs.readFileAsync(path.join(__dirname, '../templates/wmts.hbs')).then(function (template) {
  return handlebars.compile(template.toString());
});
var merc = require('./merc');
var normalizeObj = require('./normalizeObj');
var defaultCache = require('./memCache');

var makeUnknownError = require('./makeUnknownError');
var getCapabilities = Promise.coroutine(_getCapabilities);

var makeHost = require('./makeHost');
module.exports = module.exports = function (layers, params, cache, callback) {
  if (typeof cache === 'function') {
    callback = cache;
    cache = undefined;
  }
  if (typeof cache === 'undefined') {
    cache = defaultCache;
  }
  return getCapabilities(layers, params, cache).asCallback(callback);
};

function * _getCapabilities(layers, rawParams) {
  try {
    layers = yield layers;
  } catch (e) {
    return makeUnknownError(e);
  }
  if (!layers) {
    throw new TypeError('options are required');
  }
  var params = normalizeObj(rawParams);
  var template;
  var service = params.service && params.service.toLowerCase();
  if (service === 'wms') {
    template = yield wms;
  } else if (service === 'wmts') {
    template = yield wmts;
  } else {
    throw new TypeError(`unknown service: ${params.service}`);
  }
  var tileSets = new Set();
  var out = {
    title: layers.title || '',
    abstract: layers.abstract || '',
    host: makeHost(layers.host),
    layers: makeLayers(layers.layers, tileSets),
    tilematrix: []
  };
  if (typeof layers.layerLimit === 'number') {
    out.layerLimit = layers.layerLimit;
  }
  if (layers.wmshost) {
    out.wmshost = makeHost(layers.wmshost);
  } else {
    out.wmshost = out.host;
  }
  for (let matrix of tileSets) {
    out.tilematrix.push(makeTileSet(matrix));
  }
  var data = new Buffer(template(out));
  var headers = {
    'content-type': 'text/xml',
    'content-length': data.length,
    etag: getEtag(data)
  };
  return {
    data: data,
    headers: headers,
    code: 200
  };
}
function makeLayers(layers, tileSets) {
  if (!Array.isArray(layers) || !layers.length) {
    throw new Error('layers are not optional');
  }

  return layers.map(function (layer) {
    if (!layer) {
      return;
    }
    if (layer.viewable === false) {
      return;
    }
    var out = {
      title: layer.title || '',
      name: layer.name || layer.identifier || '',
      png: true,
      jpeg: true
    };
    if (Array.isArray(layer.image)) {
      if (layer.image.indexOf('png') === -1) {
        out.png = false;
      }
      if (layer.image.indexOf('jpeg') === -1) {
        out.jpeg = false;
      }
    }

    var bl = merc.forward(layer.bbox.slice(0, 2));
    out.mercminx = bl[0];
    out.mercminy = bl[1];
    var tr = merc.forward(layer.bbox.slice(2, 4));
    out.mercmaxx = tr[0];
    out.mercmaxy = tr[1];
    out.minx = layer.bbox[0];
    out.miny = layer.bbox[1];
    out.maxx = layer.bbox[2];
    out.maxy = layer.bbox[3];
    out.tileset = layer.range.join('to');
    tileSets.add(out.tileset);
    out.tilelimits = getTileLimits(layer.bbox, layer.range[0], layer.range[1]);
    return out;
  }).filter(function (layer) {
    return layer;
  });
}
function getTileLimits(bbox, minzoom, maxzoom) {
  var i = minzoom;
  var out = [];
  while (i <= maxzoom) {
    out.push({
      zoom: i < 10 ? '0' + i.toString() : i.toString(),
      bbox: merc.xyz(bbox, i)
    });
    i++;
  }
  return out;
}
function makeTileSet(layer) {
  var out = {name: layer};
  var split = layer.split('to');
  var min = parseInt(split[0], 10);
  var max = parseInt(split[1], 10);
  var i = min;
  while (i <= max) {
    out['level' + i] = true;
    i++;
  }
  return out;
}

'use strict';
var fs = require('fs');
var handlebars = require('handlebars');
var path = require('path');
var wms = handlebars.compile(fs.readFileSync(path.join(__dirname, 'wms.hbs')));
var wmts = handlebars.compile(fs.readFileSync(path.join(__dirname, 'wmts.hbs')));
var merc = require('./merc');

var makeHost = require('./makeHost');
module.exports = getCapabilities;

function getCapabilities(options) {
  if (!options) {
    throw new TypeError('options are required');
  }
  var template;
  if (options.service === 'wms') {
    template = wms;
  } else if (options.service === 'wmts') {
    template = wmts;
  } else {
    throw new TypeError(`unknown service: ${options.service}`);
  }
  var tileSets = new Set();
  var out = {
    title: options.title || '',
    abstract: options.abstract || '',
    host: makeHost(options.host),
    layers: makeLayers(options.layers, tileSets),
    tilematrix: []
  };
  for (let matrix of tileSets) {
    out.tilematrix.push(makeTileSet(matrix));
  }
  return template(out);
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

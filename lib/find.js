'use strict';

module.exports = find;

function find(layers, target) {
  if (!Array.isArray(layers)) {
    if (layers.abstract && Array.isArray(layers.layers)) {
      layers = layers.layers;
    } else if (layers.name === target || layers.identifier === target) {
      return normalize(layers);
    }
  }
  console.log(target);
  for (let layer of layers) {
    if (layer.name === target || layer.identifier === target) {
      return normalize(layer);
    }
  }
}
function normalize(layer) {
  if (!layer.name && layer.identifier) {
    layer.name = layer.identifier;
  }
  return layer;
}

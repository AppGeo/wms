'use strict';
var merc = require('./merc');

module.exports = checkTile;
function checkTile(layer, x, y, z) {
  if (z < layer.range[0] || z > layer.range[1]) {
    return 'TILEMATRIX';
  }
  var tilebbox = merc.xyz(layer.bbox, z);
  if (y < tilebbox.minY || y > tilebbox.maxY) {
    return 'TILEROW';
  }
  if (x < tilebbox.minX || x > tilebbox.maxX) {
    return 'TILECOLUMN';
  }
  return false;
}

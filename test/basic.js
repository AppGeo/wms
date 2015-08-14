'use strict';

var test = require('tape');

var wms = require('../lib');


// - **title**: title for the service
// - **abstract**: short description
// - **host**: the host where the service lives
// - **layers**: array of layer objects with the following keys
//     - **viewable**: if set to false then the layer won't be included
//     - **title**: title of the layer
//     - **name**: identifier for the layer
//     - **bbox**: bounding box for the layer in, array in [minx, miny, minx, miny] format
//     - **range**: array containing the min and max zooms in terms of tile zooms in [minZoom, maxZoom] format.
//     - **image**: Array with the image types the layer should support, defaults to `['png', 'jpeg']` which are also the only two options, mainly relevant because arcgis offers no ability to select image format (defaulting to 'jpeg' making it impossible to pick png if jpeg is available).
//     - **getTile**:
var obj = {
  title: 'a title',
  abstract: 'not like picaso',
  host: 'abc://blah.blah',
  layers: [
    {
      title: 'my layer',
      name: 'jeffery',
      bbox: [-73.916015625,
          41.16211393939692,
          -69.67529296875,
          43.02071359427862],
      range: [0, 20]
    }
  ]
};
test('basic wms', function (t) {
  t.plan(3);
  wms(obj, {
    service: 'wms',
    request: 'GetCapabilities'
  }).then(function (resp) {
    t.ok(Buffer.isBuffer(resp.data), 'got a buffer');
    t.equals(resp.code, 200, 'correct code');
    t.ok(resp.headers, 'got headers');
  }).catch(function (e) {
    t.notOk(e);
  });
});
test('basic wmts', function (t) {
  t.plan(3);
  wms(obj, {
    service: 'wmts',
    request: 'GetCapabilities'
  }).then(function (resp) {
    t.ok(Buffer.isBuffer(resp.data), 'got a buffer');
    t.equals(resp.code, 200, 'correct code');
    t.ok(resp.headers, 'got headers');
  }).catch(function (e) {
    t.notOk(e);
  });
});

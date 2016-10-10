'use strict';

var test = require('tape');

var wms = require('../lib');

var qs = require('querystring');
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
var fakeTile = new Buffer('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABmJLR0QA/wD/AP+gvaeTAAABFUlEQVR42u3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBPAAB2ClDBAAAAABJRU5ErkJggg==', 'base64');
var fakeHeaders = {
  'content-type': 'image/png',
  foo: 'bar'
};
var obj = {
  title: 'a title',
  abstract: 'not like picaso',
  host: 'abc://blah.blah',
  layers: [
    {
      title: 'my layer',
      name: 'jeffery',
      bbox: [-106.787109375, 25.8394494020632,
          -93.427734375, 36.6331620955865],
      range: [0, 20],
      getTile: function (a, b, c, cb) {
        process.nextTick(cb, null, fakeTile, fakeHeaders);
      }
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
test('basic wmts getTile request', function (t) {
  t.plan(4);
  wms(obj, qs.parse('service=WMTS&request=GetTile&version=1.0.0&layer=jeffery&style=default&format=image/png&TileMatrixSet=0to20&TileMatrix=0to20:18&TileRow=105976&TileCol=62375')
  ).then(function (resp) {
    t.ok(Buffer.isBuffer(resp.data), 'got a buffer');
    t.equals(resp.data.toString('hex'), fakeTile.toString('hex'), 'same data');
    t.equals(resp.code, 200, 'correct code');
    t.equals(resp.headers.foo, 'bar', 'got custom headers');
  }).catch(function (e) {
    t.notOk(e);
  });
});
test('basic wmts getTile for out of range request', function (t) {
  t.plan(4);
  wms(obj, qs.parse('service=WMTS&request=GetTile&version=1.0.0&layer=jeffery&style=default&format=image/png&TileMatrixSet=0to20&TileMatrix=0to20:18&TileRow=63040&TileCol=62375')
  ).then(function (resp) {
    t.ok(Buffer.isBuffer(resp.data), 'got a buffer');
    t.equals(resp.data.toString(), '<ExceptionReport version="1.1.0" xmlns="http://www.opengis.net/ows/1.1"\n  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n  xsi:schemaLocation="http://www.opengis.net/ows/1.1 http://geowebcache.org/schema/ows/1.1.0/owsExceptionReport.xsd">\n  <Exception exceptionCode="TileOutOfRange"  locator="TILEROW" >\n    <ExceptionText>TILEROW is out of range</ExceptionText>\n  </Exception>\n</ExceptionReport>\n', 'exception text');
    t.equals(resp.code, 400, 'correct code');
    t.ok(resp.headers, 'got headers');
  }).catch(function (e) {
    t.notOk(e);
  });
});

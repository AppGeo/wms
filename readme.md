wms
====

WMS and WMTS web service for Node.js.

Only works in spherical web mercator, expects a tiled source, requires Graphics Magic to be available, and a version of node that has support for ES6 features (specifically template literals, generators, and WeakMaps).

API
---

The module is a function which takes 2 and a half parameters. The first is service config, the full config is below, but is only mandatory for `getCapabilities`, `getMap` and `getTile` may pass just the layers array or just the layer object (for `getTile` and `getMap` with only one layer requested).

- **title**: title for the service
- **abstract**: short description
- **host**: the host where the service lives
- **layers**: array of layer objects with the following keys
    - **viewable**: if set to false then the layer won't be included
    - **title**: title of the layer
    - **name**: identifier for the layer
    - **bbox**: bounding box for the layer in, array in [minx, miny, minx, miny] format
    - **range**: array containing the min and max zooms in terms of tile zooms in [minZoom, maxZoom] format.
    - **image**: Array with the image types the layer should support, defaults to `['png', 'jpeg']` which are also the only two options, mainly relevant because arcgis offers no ability to select image format (defaulting to 'jpeg' making it impossible to pick png if jpeg is available).
    - **getTile**: function called to get tiles, not needed for `getCapabilities`.

The second argument is the query string. These are the arguments being sent to the server via query string e.g. in Express it's `req.query`.

Either a callback can be supplied or if not it returns a promise (this is the half a parameter).

The callback is called with (or the promise resolves with) an object with the following properties:

- **data**: a buffer with the data to return
- **headers**: headers
- **code**: status code

So with Express you can just call

```js
var wms = require('wms');
app.get('/something', function (req, res){
  wms(layerInfo, req.query).then(function (wmsResponse) {
    res.set(wmsResponse.headers);
    res.status(wmsResponse.code);
    res.send(wmsResponse.data);
  });
});
```

getTile function
----------------

Both WMS and WMTS require a `getTile` function which is called with `zoom`, `level`, and `row` of a tile and a callback. The callback needs to be called with the time or an error or the tile and buffer. For example:

```js
function(z, x, y, callback){
  // do something
  return callback(null, buffer, headers);
}
```

This will not be called if the tile is outside of the bounding box or zoom range.


Should you use a WMS or a WMTS?
-------------------------------

Always use a WMTS over a WMS if given a choice. Only ever use a WMS if you don't have a choice.  WMS is very slow. This is not a bug; this is a consequence of how it works.

Even better then a WMTS server - use a TMS as it allows the server to make and send tiles in arbitrary and mixed formats.

Spec Compliance
---------------

This implementation of a WMS/WMTS server is written with a sensibility more akin to JSON then XML. In other words, mandatory parameters that can be inferred from context do not cause an exception to be throw. For instance: since only WMTS supports `GetTile`, and only WMS supports `GetMap`, and the only request they both support is `GetCapabilities`, omitting the `service` parameter will only throw an error on a `GetCapabilities` request.

Despite the incredible detail paid to certain areas of the spec, there are situations that are are not covered. For instance, with a WMTS service, the only way to communicate that a tile was not found in the cache is to tell the client that it was out of range. In other words, it does not cover the case where the data behind the cache might not be a perfect square as might be the case for, say, state-level imagery outside of the great plains. In cases like this, I've tried to be the least surprising as I can, and when conventions collide, I err on the side of the more widely used convention. So in this case, I return a `NoApplicableCode` exception report with a 404 status code. This uses the convention of issuing 404 status codes to indicate missing resources, in favor of the OGC specific convention of responding to requests for non existent resources with 400.

The OGC spec fundamentally believes that any request for data that doesn't exist is malformed by definition, because well formed requests would get data. A strict reading of the spec (specifically table 24 of the WMTS spec) would imply I should use a 500 status code for uses of `NoApplicableCode` because, from what I can tell, the OGC feels that for a server to get into the situation where there is no applicable OGC exception code would by necessity be a server error, because if the server was constructed properly it would never be in this situation.

It is currently not possible to specify additional `SRS` codes for WMS requests, but should in theory be possible via GDAL. This faces the road block of GDAL hating you and not supporting stdin/stdout, and the fact it would cause the already slow WMS to be even slower.

The chances of adding in additional tile pyramids are approximately 0, as the massive increase in complexity would likely not bring in much useful benefits as it is rare to see the same custom tile pyramid used by 2 different groups, and almost unheard of to see the same custom tile pyramid used across state lines.

License
-------

[MIT](license.md)

wms
====

WMS and WMTS web service for node.js only works in spherical web mercator, currently expects a tiled source, requires Graphics Magic to be available and a version of node that has support for ES6 features (specifically template literals, generators, and WeakMaps).

API
===

The module is a function which takes 2 required parameters and 2 optional ones parameters.  The first is service config, the full config is bellow, but is only mandatory for getCapabilities, getMap and getTile may pass just the layers array or just the layer object (for getTile and getMap with only one layer requested).

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
    - **getTile**: function called to get tiles, not needed for getCapabilities.

The second argument is the query string.  These are the arguments being sent to the server via query string e.g. in express it's `req.query`.

A cache object may also be supplied as the 3rd argument (detailed bellow).

Either a callback can be supplied or if not it returns a promise (this is the half a parameter).

The callback is called with or the promise resolves with an object with the following properties:

- **data**: a buffer with the data to return
- **headers**: headers
- **code**: status code

so with express you can just call

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
===

Both wms and wmts require a getTile function which is called with zoom, level, and row of a tile and a callback, the callback needs to be called with the time or an error or the tile and buffer, e.g.

      function(z,x,y, callback){
          // do something
          return callback(null, buffer, headers);
      }

 this will not be called if the tile is outside of the bounding box or zoom range.


Cache Object
===

The cache object which may be supplied as the 3rd argument is an object with get and set, get takes a string and a callback, set takes a string, a buffer, and a callback.

Get returns either the object from the key, or it calls the callback with an error.

If this object is omitted then a simple lru memory cache is used, currently is only used to cache the image transforms in the WMTS service.

Should you use a WMS or a WMTS?
===

Always use a WMTS over a WMS if given a choice, only ever use a WMS if you don't have a choice.  WMS is very slow, this is not a bug, this is a consequence of how it works.

Even better then a WMTS server use a TMS as it allows the server to send make tiles in arbitrary and mixed formats.

Spec Compliance
===

This implementation of a wms/wmts server is written with a sensibility more akin to JSON then XML, in other words mandatory parameters that can be inferred from context do not cause an exception to be throw. For instance since only WMTS supports `GetTile` and only WMS supports GetMap and they only request they both support is `GetCapabilities`, then the only time omitting the `service` parameter will throw an error is on a `GetCapabilities` request.

Despite the incredible detail payed to certain areas of the spec there are situations that are are not covered.  For instance with a WMTS service the only way to communicate that a tile was not found in the cache is to tell the client that it was out of range, in other words it does not cover the case where the data behind the cache might not be a perfect square as might be the case for, say, state level imagery outside of the great plains.  In cases like this I've tried to be the least surprising as I can and when conventions collide I error on the side of the more widely used convention. So in this case I return a `NoApplicableCode` exception report with a 404 status code. This uses the everywhere on the web convention of using 404 status codes to specify missing resources in favor of the OGC specific convention of responding to requests for non existent resources with 400 because they feel that fundamentally any request for data that doesn't exist is malformed by definition, because well formed requests would get data. A strict reading for the spec (specifically table 24 of the WMTS spec) would imply I should use a 500 status code for uses of the  of `NoApplicableCode` because, from what I can tell, the OGC feels that for a server to get into the situation where there is no applicable OGC exception code would by necessity be a server error, because if the server was constructed properly it would never be in this situation.

It is currently not possible to specify additional `SRS` codes for WMS requests, but should in theory be possible via GDAL, but faces the road block of GDAL hating you and not supporting stdin/stdout and the fact it would cause the already slow WMS to be even slower.

The chances of adding in additional tile pyramids are approximately 0 as the massive increase in complexity would likely not bring in much useful benefits as it is rare to see the same custom tile pyramid used by 2 different groups and almost unheard of to see the same custom tile pyramid used across state liens.

License
===

[MIT](license.md)

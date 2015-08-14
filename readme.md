wms
====

WMS and WMTS web service for node.js only works in spherical web mercator, currently expects a tiled source.

API
===

Has 3 methods corresponding to the 3 wms/wmts methods we support (getCapabilities, getMap and getTile), all accept the same 2 and a half arguments, you can also just call it as a function and it will pick the best one.

The first is service config, the full config is bellow, but is only mandatory for getCapabilities, getMap and getTile may pass just the layers array or just the layer object (for getTile and getMap with only one layer requested).

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

Either a callback can be supplied or if not it returns a promise.

The callback is called with or the promise resolves with an object with the following properties:

- **data**: a buffer with the data to return
- **headers**: headers
- **code**: status code

so with express you can just call

```js
var wmsResponse = thingYouGotFromWMS
req.send(wmsResponse.headers);
req.status(wmsResponse.code);
req.send(wmsResponse.data);
```

getTile function
===

Both wms and wmts require a getTile function which is called with zoom, level, and row of a tile and a callback, the callback needs to be called with the time or an error or the tile and buffer, e.g.

      function(z,x,y, callback){
          // do something
          return callback(null, buffer, headers);
      }

 this will not be called if the tile is outside of the bounding box or zoom range.


Should you use a WMS or a WMTS?
===

Always use a WMTS over a WMS if given a choice, only ever use a WMS if you don't have a choice.

Even better then a WMTS server use a TMS as it allows the server to send make tiles in arbitrary and mixed formats.

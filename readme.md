wms
====

WMS and WMTS web service for node.js only works in spherical web mercator, currently expects a tiled source.

Get Capabilities
===

takes an options object with the following members

- **service**: string denoting whether it's a `wms` or `wmts` get capabilities request.
- **title**: title for the service
- **abstract**: short description
- **host**: the host where the service lives
- **layers**: array of layer objects with the following keys
    - **viewable**: if set to false then the layer won't be included
    - **title**: title of the layer
    - **name**: identifier for the layer
    - **bbox**: bounding box for the layer in, array in [minx, miny, minx, miny] format
    - **range**: array containing the min and max zooms in terms of tile zooms in [minZoom, maxZoom] format.
    - **image**: Array with the image types the layer should support, defaults to `['png', 'jpeg']` which are also the only two options, mainly relevant because arcgis offers no ability to select image format (defaulting to 'jpeg' making it imposible to pick png if jpeg is available).


Get Map and Get Tile
===

Both wms and wmts require a getTile function is called with zoom, level, and row of a tile and a callback, the callback needs to be called with the time or an error or the tile and buffer, e.g.

      function(z,x,y, callback){
          // do something
          return callback(null, buffer, headers);
      }

 this will not be called if the tile is outside of the bounding box or zoom range.

GetTile
===

takes an options object with the same members as the layer object passed in the array to get capabilities with the addition of a getTile member, the request queryParams as an object and take an optional callback parameter, if omitted a promise is returned.  

The return value is an object with the following members:

- **data**: a buffer with the data to return
- **headers**: headers
- **code**: status code

The quaryParams need the following values (all case insensative)

- **layer**: the layer name
- **tilematrix**: the tile matrix
- **tilerow**: the tile row
- **tilecol**: the tile column
- **format**: format for the tile to be returned in

GetMap
===

Similar to GetTile

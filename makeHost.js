'use strict';
var url = require('url');

module.exports = makeHost;

function makeHost(rawUrl) {
  if (!rawUrl) {
    throw new TypeError('no url provided');
  }
  var parsedUrl = url.parse(rawUrl);
  if (!parsedUrl.protocol) {
    throw new Error('invalid protocol');
  }
  var outUrl = `${parsedUrl.protocol}//`;
  if (!parsedUrl.port || parsedUrl.port === '80') {
    outUrl += parsedUrl.hostName;
  } else {
    outUrl += parsedUrl.host;
  }
  if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
    var path = parsedUrl.pathname;
    if (path.slice(-1) === '/') {
      path = path.slice(0, -1);
    }
    outUrl += path;
  }
  return outUrl;
}

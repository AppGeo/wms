'use strict';
var getEtag = require('./getEtag');

var errors = new Map();

var handlebars = require('handlebars');
module.exports = makeError;
function makeError(text, code, locator) {
  console.log((new Error('trace')).stack);
  var key = [text, code, locator].join('/');
  var data;
  if (errors.has(key)) {
    data = errors.get(key);
  } else {
    var params = {
      code: code,
      text: text
    };
    if (locator) {
      params.locator = locator;
    }
    var errData = new Buffer(rangeError(params), 'utf8');
    data = {
      resp: errData,
      etag: getEtag(errData),
      len: errData.length
    };
    errors.set(key, data);
  }
  return {
    data: data.resp,
    headers: {
      'content-type': 'application/xml',
      'content-length': data.len,
      etag: data.etag
    },
    code: 400
  };
}

var rangeError = handlebars.compile(`<ExceptionReport version="1.1.0" xmlns="http://www.opengis.net/ows/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/ows/1.1 http://geowebcache.org/schema/ows/1.1.0/owsExceptionReport.xsd">
  <Exception exceptionCode="{{code}}" {{#if locator}} locator="{{locator}}" {{/if}}>
    <ExceptionText>{{text}}</ExceptionText>
  </Exception>
</ExceptionReport>
`);

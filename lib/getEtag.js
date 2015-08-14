'use strict';

var crypto = require('crypto');

module.exports = getEtag;

function getEtag(data) {
  return crypto.createHash('sha224').update(data).digest('base64');
}

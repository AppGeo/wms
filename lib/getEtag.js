

const {createHash} = require('crypto');

module.exports = getEtag;

function getEtag(data) {
  return createHash('sha224').update(data).digest('base64');
}

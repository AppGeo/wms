
'use strict';
module.exports = imageType;
function imageType(data) {
  if (data.slice(0, 4).toString('hex') === '89504e47') {
    return 'image/png';
  } else if (data.slice(0, 2).toString('hex') === 'ffd8') {
    return 'image/jpeg';
  }
  throw new Error('unknown image type');
}

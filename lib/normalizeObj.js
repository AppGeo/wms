'use strict';

module.exports = normalizeObj;
function normalizeObj(obj) {
  return Object.keys(obj).reduce(function (acc, item) {
    acc[item.toLowerCase()] = obj[item];
    return acc;
  }, {});
}

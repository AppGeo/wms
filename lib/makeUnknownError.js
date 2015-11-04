'use strict';
var makeError = require('./makeError');
module.exports = makeUnknownError;
function makeUnknownError(e) {
  var message = typeof e === 'string' ? e : 'unknown error';
  if (process.env.NODE_ENV !== 'production' && e) {
    if (e.stack) {
      message = e.stack;
    } else if (e.message) {
      message = e.message;
    }
  }
  var resp = makeError(message, 'NoApplicableCode');
  resp.code = 500;
  return resp;
}

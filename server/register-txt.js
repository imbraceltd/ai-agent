// Registers .txt files as plain string modules for ts-node (dev only)
require.extensions['.txt'] = function (module, filename) {
  module.exports = require('fs').readFileSync(filename, 'utf8');
};

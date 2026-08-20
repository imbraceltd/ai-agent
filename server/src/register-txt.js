/**
 * Custom require hook for .txt file imports.
 * Allows ts-node (development) to handle `import x from "./file.txt"`
 * the same way esbuild's "text" loader does at build time.
 */
const fs = require("fs");

require.extensions[".txt"] = function (module, filename) {
  const content = fs.readFileSync(filename, "utf-8");
  module.exports = content;
};

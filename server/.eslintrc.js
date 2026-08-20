module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended"],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [".eslintrc.js", "dist/", "coverage/"],
  rules: {
    "no-unused-vars": "off", // Disable base rule for TypeScript
    // "no-console": "warn",
    "prefer-const": "error",
    "no-var": "error",
    "block-scoped-var": "error",
    "no-inner-declarations": "error",
  },
};

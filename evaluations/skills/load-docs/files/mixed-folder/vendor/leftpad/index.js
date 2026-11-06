// Vendored dependency - should be skipped by load-docs folder filtering.
module.exports = function leftpad(str, len, ch) {
  return String(ch || ' ').repeat(Math.max(0, len - String(str).length)) + str;
};

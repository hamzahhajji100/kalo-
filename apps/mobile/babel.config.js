module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // Drizzle migrations are shipped as .sql files and inlined at build time.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};

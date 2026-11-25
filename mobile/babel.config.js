module.exports = function(api) {
  api.cache(true);
  return {
    // Expo SDK 54 installs its compatible preset inside its own dependency tree.
    presets: [require.resolve('babel-preset-expo', {
      paths: [require('node:path').dirname(require.resolve('expo/package.json'))],
    })],
    plugins: [[require('./scripts/typography-policy.cjs'), { root: __dirname }]],
  };
};

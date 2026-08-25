// Mismo config que apps/mobile/.babelrc.js.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};

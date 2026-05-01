module.exports = function (api) {
  api.cache(true);
  // In Jest (NODE_ENV=test) skip the reanimated worklets plugin —
  // it requires react-native-worklets which is unavailable in Node.
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: ['babel-preset-expo'],
    plugins: isTest ? [] : ['react-native-reanimated/plugin'],
  };
};

// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for additional asset extensions
config.resolver.assetExts.push('wasm');

// Add source extensions
config.resolver.sourceExts.push('cjs');

// Add Node.js polyfills for React Native
config.resolver.extraNodeModules = {
  util: require.resolve('util/'),
  stream: require.resolve('stream-browserify'),
  events: require.resolve('events/'),
  buffer: require.resolve('buffer/'),
  crypto: require.resolve('react-native-get-random-values'),
};

module.exports = config;

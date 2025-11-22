// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for additional asset extensions
config.resolver.assetExts.push('wasm');

// Add source extensions
config.resolver.sourceExts.push('cjs');

module.exports = config;

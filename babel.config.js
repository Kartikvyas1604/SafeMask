module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Add support for Node.js built-in modules in React Native
      ['module-resolver', {
        alias: {
          'util': 'util/',
          'stream': 'stream-browserify',
          'events': 'events/',
          'buffer': 'buffer/',
        }
      }]
    ]
  };
};
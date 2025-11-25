module.exports = ({ config }) => ({
  expo: {
    name: 'Zetaris',
    slug: 'Zetaris',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.kartikvyas.Zetaris',
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: 'Allow Zetaris to use the camera for QR code scanning',
        NSLocationWhenInUseUsageDescription: 'Allow Zetaris to access your location for mesh network features',
      },
    },
    android: {
      package: 'com.kartikvyas.Zetaris',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: [
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      ...(config?.extra || {}),
      COINGECKO_API_KEY:
        process.env.COINGECKO_API_KEY ||
        process.env.EXPO_PUBLIC_COINGECKO_API_KEY ||
        '',
      MARKET_DATA_PROVIDER:
        process.env.MARKET_DATA_PROVIDER ||
        process.env.EXPO_PUBLIC_MARKET_DATA_PROVIDER ||
        'coingecko',
      MARKET_DATA_URL_TEMPLATE:
        process.env.MARKET_DATA_URL_TEMPLATE ||
        process.env.EXPO_PUBLIC_MARKET_DATA_URL_TEMPLATE ||
        '',
      MARKET_DATA_API_KEY:
        process.env.MARKET_DATA_API_KEY ||
        process.env.EXPO_PUBLIC_MARKET_DATA_API_KEY ||
        '',
      MARKET_DATA_API_KEY_HEADER:
        process.env.MARKET_DATA_API_KEY_HEADER ||
        process.env.EXPO_PUBLIC_MARKET_DATA_API_KEY_HEADER ||
        'x-api-key',
      MARKET_DATA_RESPONSE_PATH:
        process.env.MARKET_DATA_RESPONSE_PATH ||
        process.env.EXPO_PUBLIC_MARKET_DATA_RESPONSE_PATH ||
        'prices',
      MARKET_DATA_RESPONSE_FORMAT:
        process.env.MARKET_DATA_RESPONSE_FORMAT ||
        process.env.EXPO_PUBLIC_MARKET_DATA_RESPONSE_FORMAT ||
        'array',
    },
  },
});


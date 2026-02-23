const dotenv = require('dotenv')

// Load environment variables from the chosen file (defaults to .env.local)
const ENVFILE =
  process.env.ENVFILE || process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : `.env.local`
dotenv.config({ path: ENVFILE })

const config = {
  expo: {
    name: 'card-mania',
    slug: 'card-mania',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'cardmania',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.smoodee.cardmania',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'com.smoodee.cardmania',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#0C0C0C',
        },
      ],
      'expo-asset',
      [
        'expo-build-properties',
        {
          ios: {
            newArchEnabled: true,
          },
          android: {
            newArchEnabled: true,
            kotlinVersion: '1.6.21',
          },
        },
      ],
      'expo-font',
      'expo-web-browser',
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: 'react-native',
          organization: 'vincentlamdev',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '7cb44e39-440b-46be-b799-ba4b345ed43c',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/7cb44e39-440b-46be-b799-ba4b345ed43c',
    },
  },
}

module.exports = () => config

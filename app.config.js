const config = {
  expo: {
    name: 'card-mania',
    slug: 'card-mania',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/CM_LOGO.png',
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
        foregroundImage: './assets/images/CM_LOGO.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'com.smoodee.cardmania',
    },
    web: {
      bundler: 'metro',
      favicon: './assets/images/CM_LOGO.png',
    },
    plugins: [
      'expo-router',
      '@sentry/react-native',
      'expo-image',
      [
        'expo-splash-screen',
        {
          image: './assets/images/CM_LOGO.png',
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
          project: 'card-mania',
          organization: 'vincent-lam-i6',
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
      sentryDSN:
        'https://6ece37dd94482fb17a990e2a444d190a@o4511347914637312.ingest.us.sentry.io/4511347916668928',
      supabaseUrl: 'https://zijgqgpwmqrgnzcictcb.supabase.co',
      supabaseKey: 'sb_publishable_pA4yv9B6SuKYjzKlIvnDDw_3R9J1ATm',
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

const { withNativeWind } = require('nativewind/metro')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

module.exports = (() => {
  // 1. Base config — includes Expo's transformer chain and context-module support
  let config = getSentryExpoConfig(__dirname)

  // 2. Let NativeWind modify it first
  config = withNativeWind(config, { input: './global.css' })

  // 3. Patch in the SVG transformer + resolver tweaks
  //
  // IMPORTANT: use react-native-svg-transformer/expo (not the bare package).
  //
  // The bare `react-native-svg-transformer` chains non-SVG files through
  // metro-react-native-babel-transformer, which bypasses Expo's own
  // @expo/metro-config/babel-transformer. That Expo transformer is what runs
  // babel-preset-expo on every file — including expo-router's _ctx.web.js —
  // and substitutes process.env.EXPO_ROUTER_APP_ROOT with the literal app
  // directory path before Metro's require.context() evaluation.
  //
  // Without this substitution the web build throws:
  //   Invalid call at line 2: process.env.EXPO_ROUTER_APP_ROOT
  //   First argument of require.context should be a string.
  //
  // react-native-svg-transformer/expo chains non-SVG files through
  // @expo/metro-config/babel-transformer, preserving the full transform chain.
  const { assetExts, sourceExts } = config.resolver

  config.resolver.assetExts = assetExts.filter((ext) => ext !== 'svg')
  config.resolver.sourceExts = [...sourceExts, 'svg']
  config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles']
  config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo')

  // Belt-and-suspenders: explicitly enable context modules so the Expo Router
  // require.context() call works even if getSentryExpoConfig doesn't inherit
  // unstable_allowRequireContext from @expo/metro-config's getDefaultConfig.
  config.transformer.unstable_allowRequireContext = true

  config.transformer.getTransformOptions = async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  })

  return config
})()

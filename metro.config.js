const { withNativeWind } = require('nativewind/metro')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const path = require('path')

module.exports = (() => {
  // 1. Base config — includes Expo's transformer chain and context-module support
  let config = getSentryExpoConfig(__dirname)

  // Set getTransformOptions BEFORE withNativeWind so NativeWind's CSS-processing
  // wrapper can chain through it. Setting it after withNativeWind overwrites
  // NativeWind's wrapper entirely, which skips Tailwind CSS compilation.
  config.transformer.getTransformOptions = async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  })

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

  const zustandDir = path.dirname(require.resolve('zustand/package.json'))
  const skiaNativeStub = path.resolve(__dirname, 'lib/stubs/react-native-skia.js')
  const nativeWindResolveRequest = config.resolver.resolveRequest

  config.resolver.assetExts = assetExts.filter((ext) => ext !== 'svg')
  config.resolver.sourceExts = [...sourceExts, 'svg']
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web') {
      if (moduleName.startsWith('zustand/')) {
        const sub = moduleName.slice('zustand/'.length)
        return { filePath: path.join(zustandDir, `${sub}.js`), type: 'sourceFile' }
      }
      // Skia requires a WASM runtime (CanvasKit) that is not available on web.
      // Redirect all Skia imports to a no-op stub; .web.tsx overrides provide
      // CSS/Reanimated equivalents for components that actually need to render.
      if (
        moduleName === '@shopify/react-native-skia' ||
        moduleName.startsWith('@shopify/react-native-skia/')
      ) {
        return { filePath: skiaNativeStub, type: 'sourceFile' }
      }
      if (
        (moduleName === 'react-native-worklets' ||
          moduleName.startsWith('react-native-worklets/')) &&
        moduleName !== 'react-native-worklets/package.json'
      ) {
        const workletsStub = path.resolve(__dirname, 'lib/stubs/react-native-worklets.js')
        return { filePath: workletsStub, type: 'sourceFile' }
      }
    }
    return nativeWindResolveRequest
      ? nativeWindResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform)
  }
  config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles']
  config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo')

  // Belt-and-suspenders: explicitly enable context modules so the Expo Router
  // require.context() call works even if getSentryExpoConfig doesn't inherit
  // unstable_allowRequireContext from @expo/metro-config's getDefaultConfig.
  config.transformer.unstable_allowRequireContext = true

  return config
})()

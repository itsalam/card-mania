const { withNativeWind } = require('nativewind/metro');
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

// let defaultConfig = getDefaultConfig(__dirname);

module.exports = (() => {
  // 1. Base config
  let config = getSentryExpoConfig(__dirname);

  // 2. Let NativeWind modify it first
  config = withNativeWind(config, { input: './global.css' });

  // 3. Now patch in the SVG transformer + resolver tweaks
  const { assetExts, sourceExts } = config.resolver;

  config.resolver.assetExts = assetExts.filter((ext) => ext !== 'svg');
  config.resolver.sourceExts = [...sourceExts, 'svg'];
  config.transformer.assetPlugins= ['expo-asset/tools/hashAssetFiles']
  config.transformer.babelTransformerPath = require.resolve(
    'react-native-svg-transformer'
  );

  config.transformer.getTransformOptions = async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  });

  return config;
})();
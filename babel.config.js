module.exports = function (api) {
  api.cache(true)

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
        },
      ],
      'nativewind/babel',
    ],

    plugins: [
      // Required by @storybook/react-native to generate TypeScript prop controls
      'babel-plugin-react-docgen-typescript',
      // Required by @storybook/react-native/babel to auto-discover story files
      ...(process.env.EXPO_PUBLIC_STORYBOOK === 'true'
        ? [require.resolve('@storybook/react-native/babel')]
        : []),
      [
        'module-resolver',
        {
          root: ['./'],

          alias: {
            '@': './',
            'tailwind.config': './tailwind.config.js',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  }
}

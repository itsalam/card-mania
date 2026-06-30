import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import type { StorybookConfig } from '@storybook/react-vite'
import { mergeConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.?(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [react()],
      resolve: {
        // Prefer .web.tsx over .tsx so web-override files are picked up,
        // mirroring Metro's platform-specific resolution.
        extensions: [
          '.web.tsx',
          '.web.ts',
          '.web.jsx',
          '.web.js',
          '.tsx',
          '.ts',
          '.jsx',
          '.js',
          '.json',
        ],
        alias: {
          // Module aliases matching babel.config.js module-resolver
          '@': root,
          'tailwind.config': path.resolve(root, 'tailwind.config.js'),
          // Map react-native → react-native-web so RN components render in browser
          'react-native': path.resolve(root, 'node_modules/react-native-web'),
          // Stub out native-only packages that can't run in a browser
          '@shopify/react-native-skia': path.resolve(root, 'lib/stubs/react-native-skia.js'),
          'react-native-worklets': path.resolve(root, 'lib/stubs/react-native-worklets.js'),
          // react-native-reanimated web build
          'react-native-reanimated': path.resolve(
            root,
            'node_modules/react-native-reanimated/src/index.ts'
          ),
        },
      },
      define: {
        // Required by react-native-web
        __DEV__: JSON.stringify(true),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
      },
    })
  },
}

export default config

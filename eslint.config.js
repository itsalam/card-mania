// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'supabase/functions/**/*.ts',
      'etc/*',
      'scripts/*',
      'docs/*',
      // design-sync tooling & artifacts: previews import the virtual 'card-mania'
      // specifier (resolved to window.CardMania at sync time), not a real module.
      '.design-sync/**',
      '.ds-sync/**',
      'ds-bundle/**',
    ],
  },
])

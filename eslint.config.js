// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const globals = require('globals')

module.exports = defineConfig([
  expoConfig,
  {
    files: ['__tests__/**/*.{js,ts,tsx}', 'jest.setup.js'],
    languageOptions: {
      globals: globals.jest,
    },
  },
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
      // Retool admin console exports (ITS-116): Retool's own React/JSON, imports Retool-only
      // modules — kept verbatim so it re-imports cleanly. See retool/README.md.
      'retool/**',
    ],
  },
])

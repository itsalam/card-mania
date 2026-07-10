/**
 * No-op stub for @react-native-community/datetimepicker on web.
 *
 * The package ships its source with Flow type annotations, which Vite/esbuild
 * cannot parse. The component itself wraps a native date/time picker OS widget
 * with no web equivalent, so a null stub is correct for the web Storybook
 * environment — no stories exercise this component.
 */
const React = require('react')

const DateTimePicker = () => null

module.exports = DateTimePicker
module.exports.default = DateTimePicker

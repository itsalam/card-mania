/**
 * No-op stub for react-native/Libraries/ReactNative/AppContainer on web.
 * react-native-screens imports this internal RN class; react-native-web does
 * not expose it. The stub passes children through so any accidental render
 * still works.
 */
const React = require('react')

function AppContainer({ children }) {
  return React.createElement(React.Fragment, null, children)
}

module.exports = AppContainer
module.exports.default = AppContainer

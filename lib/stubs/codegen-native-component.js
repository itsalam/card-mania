/**
 * No-op stub for react-native/Libraries/Utilities/codegenNativeComponent on web.
 * This internal RN utility generates native component classes from a schema;
 * react-native-web does not ship it. Any Fabric component that calls this at
 * module-evaluation time (e.g. react-native-svg Fabric components) will
 * receive a null placeholder so bundling continues without errors.
 */
function codegenNativeComponent() {
  return null
}

module.exports = codegenNativeComponent
module.exports.default = codegenNativeComponent

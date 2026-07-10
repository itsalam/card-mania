/**
 * No-op stub for uilib-native on web.
 * uilib-native is the native-side split of react-native-ui-lib and includes
 * components such as DynamicFonts that depend on native permissions APIs not
 * available (or meaningful) on web. react-native-ui-lib operates correctly
 * without these native-only additions when running under react-native-web.
 */
const stub = new Proxy(
  {},
  {
    get(_, key) {
      if (key === '__esModule') return true
      if (key === 'default') return stub
      return null
    },
  }
)

module.exports = stub

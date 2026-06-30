// No-op stub for @shopify/react-native-skia on web.
// The real package requires a WASM runtime not available in web/Storybook builds.
module.exports = new Proxy(
  {},
  {
    get(_, key) {
      if (key === '__esModule') return true
      if (key === 'default') return {}
      return () => null
    },
  }
)

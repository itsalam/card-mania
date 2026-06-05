/**
 * No-op stub for @shopify/react-native-skia on web.
 *
 * Skia requires a WebAssembly runtime (CanvasKit) that is not loaded in the
 * web bundle. All Skia components and APIs are replaced by a Proxy that returns
 * a no-op React component for any named export, so files that import Skia can
 * still be bundled without crashing at module-evaluation time.
 *
 * Platform-specific overrides (.web.tsx) replace the actual Skia usages with
 * CSS/Reanimated equivalents, so at runtime nothing renders through this stub.
 */
const React = require('react')

const NoOp = () => null
NoOp.displayName = 'SkiaStub'

const stub = new Proxy(
  {},
  {
    get(_, key) {
      if (key === '__esModule') return true
      if (key === 'default') return stub
      // Hooks: return a no-op function that returns a safe default
      if (typeof key === 'string' && key.startsWith('use')) return () => ({ current: null })
      return NoOp
    },
  }
)

module.exports = stub

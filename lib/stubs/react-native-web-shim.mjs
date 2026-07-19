/**
 * Shim that stands in for `react-native` in the web Storybook build.
 *
 * react-native-web implements the public RN surface area for browsers, but it
 * deliberately omits native-only APIs (Fabric code-gen, TurboModule registry,
 * Android-specific components, etc.). Rolldown (Vite 8's dep optimiser) does
 * strict ESM named-export validation — unlike esbuild it hard-errors when an
 * imported name is absent from the resolved module.
 *
 * This shim:
 *   1. Re-exports every named export from react-native-web so the full public
 *      API is available (View, Text, StyleSheet, Platform, …).
 *   2. Adds explicit null/no-op stubs for the native-only names that packages
 *      such as react-native-gesture-handler, react-native-screens, and
 *      expo-modules-core try to import from 'react-native'.
 */

export * from 'react-native-web'
// react-native-web/dist/index.js is pure ESM with only named exports — no top-level
// `export default`. `export *` also never re-exports default. Packages that do
// `import ReactNative from 'react-native'` need a default; provide the namespace
// (which includes View, Text, etc.) so property access still resolves at runtime.
import * as _rnwNS from 'react-native-web'
export default _rnwNS

// ─── Native-only stubs ────────────────────────────────────────────────────────

// New Architecture native-module registry used by expo-modules-core,
// react-native-screens, and others.
export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () =>
    new Proxy({}, { get: (_, k) => (typeof k === 'string' ? () => null : undefined) }),
  has: () => false,
}

// Android-only navigation drawer — no web equivalent.
export const DrawerLayoutAndroid = null

// Fabric code-gen helpers imported as named exports by react-native-screens and others.
// (Deep-path imports via react-native/Libraries/... are intercepted separately
//  by the rn-internal stub; these cover the named-export form from 'react-native'.)
export const codegenNativeComponent = () => null
export const codegenNativeCommands = () => null

// iOS-only action sheet — no web equivalent.
export const ActionSheetIOS = null

// Platform-specific color API. On web, returns the first supplied color value as-is
// so that components using PlatformColor still render with a usable color string.
export const PlatformColor = (...colors) => colors[0] ?? null

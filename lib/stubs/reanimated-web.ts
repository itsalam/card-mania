// Web shim for react-native-reanimated.
// Re-exports everything from the package's web-compatible src/index.ts entry,
// and adds EasingNode as an alias for Easing (EasingNode was deprecated in v3
// but some packages still import it).
export * from '../../node_modules/react-native-reanimated/src/index'
// src/index.ts has `export default Animated` so we can re-export it explicitly.
export { default, Easing as EasingNode } from '../../node_modules/react-native-reanimated/src/index'

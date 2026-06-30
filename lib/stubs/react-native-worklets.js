// No-op stub for react-native-worklets on web/Storybook.
// The real package requires a native TurboModule not available in web builds.
module.exports = {
  scheduleOnRN: (fn) => fn(),
  scheduleOnUI: (fn) => fn(),
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  useSharedValue: (v) => ({ value: v }),
  useWorkletCallback: (fn) => fn,
}

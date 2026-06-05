/**
 * No-op stub for react-native-worklets on web.
 *
 * The worklets package requires a native TurboModule (NativeWorklets) that
 * does not exist on web. All exports are replaced with safe no-ops or
 * identity functions so that files importing worklets can be bundled without
 * crashing at module-evaluation time.
 *
 * scheduleOnRN is only used in the debug utility useSharedValueLogger
 * (components/utils.tsx) and is never called in production web paths.
 */
'use strict'
const NOOP = () => {}
const ID = (v) => v

module.exports = {
  scheduleOnRN: (fn, ...args) => fn(...args),
  scheduleOnUI: (fn, ...args) => fn(...args),
  runOnJS: ID,
  runOnUI: ID,
  createRunInJSFn: ID,
  createRunInContextFn: ID,
  makeShareable: ID,
  makeShareableCloneRecursive: ID,
  isWorkletFunction: () => false,
  isShareableRef: () => false,
  WorkletsModule: {},
}

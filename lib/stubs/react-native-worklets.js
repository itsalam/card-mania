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

const RuntimeKind = { ReactNative: 1, UI: 2, Worker: 3 }

module.exports = {
  RuntimeKind,
  // scheduling
  scheduleOnRN: (fn, ...args) => fn(...args),
  scheduleOnUI: NOOP,
  runOnUI: ID,
  runOnUISync: (fn, ...args) => fn(...args),
  runOnJS: ID,
  runOnRuntime: ID,
  executeOnUIRuntimeSync: (fn, ...args) => fn(...args),
  // worklet introspection
  isWorkletFunction: () => false,
  isShareableRef: () => false,
  // serializable / shareable memory
  createSerializable: ID,
  createSynchronizable: (v) => ({ value: v }),
  serializableMappingCache: { get: () => undefined, set: NOOP, delete: NOOP },
  makeShareable: ID,
  makeShareableCloneRecursive: ID,
  // runtime
  createWorkletRuntime: NOOP,
  // legacy helpers
  createRunInJSFn: ID,
  createRunInContextFn: ID,
  WorkletsModule: {},
}

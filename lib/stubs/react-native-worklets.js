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
 *
 * Authored as native ESM (not `module.exports`) so that Vite's on-demand dev
 * server exposes every name as a real named export. Reanimated's src/index.ts
 * does `import { RuntimeKind } from 'react-native-worklets'`, and Vite's CJS→ESM
 * interop does not reliably synthesise named exports for an object-literal
 * `module.exports`, which surfaced as "doesn't provide an export named
 * 'RuntimeKind'". Metro transforms this file through Babel, so ESM is fine there.
 */

// Replicate the JS-side globals that react-native-worklets sets up on load.
// The Metro stub skips the real initializers.ts, so Reanimated's valueSetter /
// core / useAnimatedStyle would throw "global._getAnimationTimestamp is not a
// function" without this.
if (typeof globalThis._getAnimationTimestamp === 'undefined') {
  globalThis._getAnimationTimestamp = () => performance.now()
}

const NOOP = () => {}
const ID = (v) => v

// Mirrors the real TS enum (forward + reverse mappings).
export const RuntimeKind = {
  ReactNative: 1,
  UI: 2,
  Worker: 3,
  1: 'ReactNative',
  2: 'UI',
  3: 'Worker',
}

// scheduling
export const scheduleOnRN = (fn, ...args) => fn(...args)
export const scheduleOnUI = NOOP
export const runOnUI = ID
export const runOnUISync = (fn, ...args) => fn(...args)
export const runOnJS = ID
export const runOnRuntime = ID
export const executeOnUIRuntimeSync = (fn, ...args) => fn(...args)

// worklet introspection
export const isWorkletFunction = () => false
export const isShareableRef = () => false

// microtask draining — real impl flushes the UI-runtime microtask queue; no-op on web.
export const callMicrotasks = NOOP

// Type-only names imported by reanimated's .ts sources. esbuild normally elides
// these as type positions, but we export runtime placeholders so Rolldown's strict
// ESM binding check passes even if a name slips through as a value import.
export const WorkletFunction = undefined
export const WorkletRuntime = undefined
export const Synchronizable = undefined
export const SerializableRef = undefined
export const MakeShareableClone = undefined
export const IWorkletsModule = undefined

// serializable / shareable memory
export const createSerializable = ID
export const createSynchronizable = (v) => ({ value: v })
export const serializableMappingCache = { get: () => undefined, set: NOOP, delete: NOOP }
export const makeShareable = ID
export const makeShareableCloneRecursive = ID

// runtime
export const createWorkletRuntime = NOOP

// legacy helpers
export const createRunInJSFn = ID
export const createRunInContextFn = ID
export const WorkletsModule = {}

// Default export for `import Worklets from 'react-native-worklets'` consumers.
export default {
  RuntimeKind,
  scheduleOnRN,
  scheduleOnUI,
  runOnUI,
  runOnUISync,
  runOnJS,
  runOnRuntime,
  executeOnUIRuntimeSync,
  isWorkletFunction,
  isShareableRef,
  callMicrotasks,
  createSerializable,
  createSynchronizable,
  serializableMappingCache,
  makeShareable,
  makeShareableCloneRecursive,
  createWorkletRuntime,
  createRunInJSFn,
  createRunInContextFn,
  WorkletsModule,
}

/**
 * No-op stub for @react-native-masked-view/masked-view on web.
 * MaskedView is backed by a native masking API that has no direct web equivalent.
 * On web the component falls through to rendering its children unmasked.
 *
 * Authored as native ESM (not `module.exports`) so Vite's on-demand dev server
 * exposes a real `default` export — its CJS→ESM interop did not synthesise one
 * here, surfacing as "doesn't provide an export named 'default'".
 */
import React from 'react'

function MaskedView({ children }) {
  return React.createElement(React.Fragment, null, children)
}

export default MaskedView
export { MaskedView }

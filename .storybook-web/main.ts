import fs from 'node:fs'
import path from 'node:path'
import * as babel from '@babel/core'
import type { StorybookConfig } from '@storybook/react-vite'
import { mergeConfig } from 'vite'

const root = path.resolve(__dirname, '..')

// Resolves a relative specifier to an absolute .js path, or null if unresolvable.
function resolveRelative(dir: string, specifier: string): string | null {
  const p = path.resolve(dir, specifier)
  if (!path.extname(p)) {
    if (fs.existsSync(p + '.js')) return p + '.js'
    const idx = path.join(p, 'index.js')
    if (fs.existsSync(idx)) return idx
    return null
  }
  return p
}

// Cache for getDeepExportedNames — persists for the whole optimizer run.
const deepExportCache = new Map<string, Set<string> | null>()

// Returns the names genuinely exported by filePath, recursively validating that
// each import binding actually exists in its source.
//
// The naive approach (reading export statements from disk) incorrectly includes
// type-only names: e.g. textField/index.js has `export { TextFieldMethods }` but
// TextFieldMethods was imported from ./types which doesn't export it — the export
// is a dead binding.  This function follows the import chain to find only the
// names that have real JS values, matching what the stripRnuiTypeReexports
// transform will leave behind.
function getDeepExportedNames(filePath: string, visiting = new Set<string>()): Set<string> | null {
  if (deepExportCache.has(filePath)) return deepExportCache.get(filePath)!
  if (visiting.has(filePath)) return new Set() // break import cycles
  const vis = new Set(visiting)
  vis.add(filePath)

  let code: string
  try {
    code = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }

  const names = new Set<string>()

  // CJS: all statically defined exports are valid (no ESM binding chain to break)
  if (code.includes('Object.defineProperty(exports')) {
    names.add('default')
    for (const m of code.matchAll(/\bexports\.([\w$]+)\s*=/g)) {
      if (m[1] !== '__esModule') names.add(m[1])
    }
    for (const m of code.matchAll(/Object\.defineProperty\(exports,\s*['"](\w+)['"]/g)) {
      if (m[1] !== '__esModule') names.add(m[1])
    }
    deepExportCache.set(filePath, names)
    return names
  }

  const dir = path.dirname(filePath)

  // "live" = names that have an actual JS value in this module's scope
  const live = new Set<string>()

  // Direct ESM declarations (`export const/class/function X`) are real exports.
  if (/\bexport\s+default\b/.test(code)) {
    live.add('default')
    names.add('default')
  }
  for (const m of code.matchAll(
    /\bexport\s+(?:const|let|var|function|class|async\s+function)\s+([\w$]+)/g
  )) {
    live.add(m[1])
    names.add(m[1])
  }

  // Plain local declarations (no `export` keyword) — a standalone `export { x }`
  // later in the file can reference these, so they count as live value bindings.
  // e.g. colorsPalette.js: `const colorsPalette = {...}; export { colorsPalette }`.
  // These go into `live` only, NOT `names` — they are not exports by themselves.
  for (const m of code.matchAll(
    /^\s*(?:const|let|var|function|class|async\s+function)\s+([\w$]+)/gm
  )) {
    live.add(m[1])
  }

  // Named and default import bindings — live only if source actually exports them.
  // Handles both `import { Named }` and `import Default, { Named }` forms.
  for (const m of code.matchAll(/\bimport\s+([^'"]+?)\s*from\s*(['"])(\.\.?\/[^'"]+)\2/g)) {
    const importSpec = m[1]
    const target = resolveRelative(dir, m[3])
    if (!target) continue
    const src = getDeepExportedNames(target, vis)
    if (!src) continue

    // Default import (e.g. `import Foo` or `import Foo, { ... }`)
    const defaultMatch = importSpec.match(/^([\w$]+)\s*(?:,|$)/)
    if (defaultMatch && src.has('default')) live.add(defaultMatch[1])

    // Named imports (e.g. `{ a, b as c }`)
    const namedMatch = importSpec.match(/\{([^}]+)\}/)
    if (namedMatch) {
      for (const n of namedMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        const orig = n.split(/\s+as\s+/)[0].trim()
        const alias = n
          .split(/\s+as\s+/)
          .pop()!
          .trim()
        if (src.has(orig)) live.add(alias)
      }
    }
  }

  // ESM re-exports — add alias only if source actually exports the original name
  for (const m of code.matchAll(/\bexport\s*\{([^}]+)\}\s*from\s*(['"])(\.\.?\/[^'"]+)\2/g)) {
    const target = resolveRelative(dir, m[3])
    if (!target) continue
    const src = getDeepExportedNames(target, vis)
    if (!src) continue
    for (const n of m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const orig = n.split(/\s+as\s+/)[0].trim()
      const alias = n
        .split(/\s+as\s+/)
        .pop()!
        .trim()
      if (src.has(orig)) names.add(alias)
    }
  }

  // Standalone exports — add alias only if the binding is live
  for (const m of code.matchAll(/\bexport\s*\{([^}]+)\}(?!\s*from)/g)) {
    for (const n of m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const orig = n.split(/\s+as\s+/)[0].trim()
      const alias = n
        .split(/\s+as\s+/)
        .pop()!
        .trim()
      if (live.has(orig)) names.add(alias)
    }
  }

  deepExportCache.set(filePath, names)
  return names
}

// Strips type-only binding errors from react-native-ui-lib/src/ files.
//
// react-native-ui-lib ships TypeScript source compiled to .js where type aliases
// and interfaces survive in three places that cause hard ESM binding errors:
//
//   1. Re-exports:  export { TypeName } from './mod'
//      → Rolldown/browser: TypeName not in mod → MISSING_EXPORT
//
//   2. Imports:     import { TypeName } from './types'
//      → Rolldown: TypeName not in types.js → binding error propagates to callers
//
//   3. Standalone:  export { TypeName }   (value came from a stripped import)
//      → Would reference an undefined binding
//
// We handle all three by reading the target file, checking which names it actually
// exports, and stripping the dead ones. Stripped import names are tracked so they
// can also be removed from the subsequent standalone export statement.
//
// Registered in TWO places (viteFinal.plugins AND optimizeDeps.rolldownOptions.plugins)
// because the Rolldown dep-optimizer runs independently and does not inherit viteFinal plugins.
function stripRnuiTypeReexports(code: string, id: string): string | null {
  if (!id.includes('/react-native-ui-lib/src/')) return null
  if (!code.includes('export') && !code.includes('import')) return null
  const dir = path.dirname(id)

  // Names stripped from import statements — used to clean standalone export statements.
  const strippedImportNames = new Set<string>()

  let result = code

  // 1. ESM re-exports: export { a, b } from './mod'
  //    Use getDeepExportedNames so intermediate files with type-only imports
  //    (like textField/index.js) don't falsely appear to export those names.
  result = result.replace(
    /export\s*\{([^}]+)\}\s*from\s*(['"])(\.\.?\/[^'"]+)\2/g,
    (match, names: string, quote: string, specifier: string) => {
      const targetPath = resolveRelative(dir, specifier)
      if (!targetPath) return match
      const available = getDeepExportedNames(targetPath)
      if (!available) return match
      const kept = names
        .split(',')
        .map((n) => n.trim())
        .filter((n) => {
          if (!n) return false
          const orig = n.split(/\s+as\s+/)[0].trim()
          return available.has(orig)
        })
      if (kept.length === 0) return ''
      return `export { ${kept.join(', ')} } from ${quote}${specifier}${quote}`
    }
  )

  // 2. Import statements — handles both `import { Named }` and `import Default, { Named }`.
  //    Strips missing named imports; records stripped local aliases for pass 3.
  result = result.replace(
    /\bimport\s+([^'"]+?)\s*from\s*(['"])(\.\.?\/[^'"]+)\2/g,
    (match, importSpec: string, quote: string, specifier: string) => {
      const namedMatch = importSpec.match(/\{([^}]+)\}/)
      if (!namedMatch) return match // no named imports to strip
      const targetPath = resolveRelative(dir, specifier)
      if (!targetPath) return match
      const available = getDeepExportedNames(targetPath)
      if (!available) return match
      const keptNamed: string[] = []
      for (const n of namedMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        const orig = n.split(/\s+as\s+/)[0].trim()
        if (available.has(orig)) {
          keptNamed.push(n)
        } else {
          strippedImportNames.add(
            n
              .split(/\s+as\s+/)
              .pop()!
              .trim()
          )
        }
      }
      // Preserve default import if present (e.g. `import Foo, { ... }`)
      const defaultMatch = importSpec.match(/^([\w$]+)\s*,/)
      const defaultPart = defaultMatch ? defaultMatch[1] : null
      if (keptNamed.length === 0 && !defaultPart) return ''
      if (keptNamed.length === 0 && defaultPart)
        return `import ${defaultPart} from ${quote}${specifier}${quote}`
      const namedPart = `{ ${keptNamed.join(', ')} }`
      const spec = defaultPart ? `${defaultPart}, ${namedPart}` : namedPart
      return `import ${spec} from ${quote}${specifier}${quote}`
    }
  )

  // 3. Standalone exports: export { a, b }  (no "from" clause)
  //    Strip any names that were cleared from imports above.
  if (strippedImportNames.size > 0) {
    result = result.replace(/export\s*\{([^}]+)\}(?!\s*from)/g, (match, names: string) => {
      const kept = names
        .split(',')
        .map((n) => n.trim())
        .filter((n) => {
          if (!n) return false
          const orig = n.split(/\s+as\s+/)[0].trim()
          return !strippedImportNames.has(orig)
        })
      if (kept.length === 0) return ''
      return `export { ${kept.join(', ')} }`
    })
  }

  return result === code ? null : result
}

// Runs react-native-worklets' Babel plugin (the same one babel.config.js applies
// in the Metro build) on app source and reanimated's TS source. Storybook's
// @storybook/react-vite already registers @vitejs/plugin-react, so adding a second
// react() with a babel config is deduped/ignored — hence this standalone transform.
// Without it, reanimated worklet callbacks (e.g. TabRow's useAnimatedStyle) are
// never workletized and reanimated throws at render.
async function transformWorklets(
  code: string,
  id: string
): Promise<{ code: string; map: any } | null> {
  const clean = id.split('?')[0]
  if (!/\.[jt]sx?$/.test(clean)) return null
  const isNodeModule = clean.includes('/node_modules/')
  // App source (outside node_modules) + reanimated's own TS source both carry
  // 'worklet' functions the plugin must process; everything else is skipped.
  if (isNodeModule && !clean.includes('/react-native-reanimated/src/')) return null
  if (isNodeModule === false && !clean.startsWith(root)) return null
  // Cheap bail-out: only pay for a Babel pass on files that touch reanimated.
  if (!code.includes('react-native-reanimated') && !code.includes('worklet')) return null

  const result = await babel.transformAsync(code, {
    filename: clean, // extension drives TS vs TSX parsing in preset-typescript
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    // Strip TS syntax so the worklets plugin sees plain JS/JSX; JSX itself is
    // left for Vite's downstream esbuild pass to transform.
    presets: [['@babel/preset-typescript', { onlyRemoveTypeImports: true }]],
    plugins: ['react-native-worklets/plugin'],
  })
  if (!result?.code) return null
  return { code: result.code, map: result.map }
}

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.?(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [
        // Workletize reanimated callbacks in app/reanimated source (see above).
        {
          name: 'reanimated-worklets',
          enforce: 'pre' as const,
          transform: transformWorklets,
        },
        // Vite dev server on-demand transform path (see stripRnuiTypeReexports above).
        {
          name: 'strip-rnui-type-reexports',
          enforce: 'pre' as const,
          transform: stripRnuiTypeReexports,
        },
      ],
      resolve: {
        // Prefer .web.* over the bare extension so web-override files win,
        // mirroring Metro's platform-specific resolution. `.web.mjs`/`.mjs` are
        // included because packages like @rn-primitives ship ESM platform files
        // (tabs.web.mjs); dropping `.mjs` — which Vite resolves by default —
        // would make those unresolvable.
        extensions: [
          '.web.tsx',
          '.web.ts',
          '.web.jsx',
          '.web.mjs',
          '.web.js',
          '.tsx',
          '.ts',
          '.jsx',
          '.mjs',
          '.js',
          '.json',
        ],
        // Array form preserves order — deep RN internal paths must be listed
        // before the react-native catch-all so they match first.
        alias: [
          // Catch-all for ALL react-native/Libraries/... deep internal paths.
          // react-native-web does not ship the Libraries/ tree, so after the
          // react-native→web alias fires these become unresolvable paths.
          // This regex intercepts them first and routes to a Proxy stub.
          {
            find: /^react-native\/Libraries\/.*/,
            replacement: path.resolve(root, 'lib/stubs/rn-internal.js'),
          },
          // Module aliases matching babel.config.js module-resolver
          { find: '@', replacement: root },
          { find: 'tailwind.config', replacement: path.resolve(root, 'tailwind.config.js') },
          // Map the bare react-native specifier to our shim (anchored regex so
          // sub-path imports like react-native/Libraries/... still fall through
          // to the catch-all above rather than hitting this replacement).
          // The shim re-exports all of react-native-web AND adds explicit stubs
          // for native-only APIs that Rolldown's strict export checking requires.
          {
            find: /^react-native$/,
            replacement: path.resolve(root, 'lib/stubs/react-native-web-shim.mjs'),
          },
          // Stub out native-only packages that can't run in a browser.
          // All stubs that point to a FILE use anchored regexes — a string find
          // matches as a prefix, so `pkg/sub-path` would be rewritten to
          // `stub.js/sub-path` ("not a directory"). Regex with $ prevents that.
          {
            find: /^@react-native-masked-view\/masked-view$/,
            replacement: path.resolve(root, 'lib/stubs/masked-view.js'),
          },
          {
            find: /^@react-native-community\/datetimepicker$/,
            replacement: path.resolve(root, 'lib/stubs/datetimepicker.js'),
          },
          {
            find: /^@shopify\/react-native-skia$/,
            replacement: path.resolve(root, 'lib/stubs/react-native-skia.js'),
          },
          {
            find: /^react-native-worklets$/,
            replacement: path.resolve(root, 'lib/stubs/react-native-worklets.js'),
          },
          // uilib-native sub-paths (e.g. uilib-native/components/DynamicFonts) are
          // also broken (missing PermissionsAcquirer), so the regex covers both the
          // bare specifier and any sub-path import from this package.
          {
            find: /^uilib-native(\/.*)?$/,
            replacement: path.resolve(root, 'lib/stubs/uilib-native.js'),
          },
          // react-native-reanimated web build via a thin wrapper that re-exports
          // src/index.ts and adds EasingNode (deprecated in v3, removed from src/index).
          {
            find: /^react-native-reanimated$/,
            replacement: path.resolve(root, 'lib/stubs/reanimated-web.ts'),
          },
        ],
      },
      optimizeDeps: {
        // @rn-primitives/* ship platform files (e.g. tabs.web.mjs — radix-backed —
        // vs the React Native tabs.mjs). The Rolldown pre-bundler resolves these to
        // their NATIVE variant (it doesn't apply the web-first resolve.extensions the
        // dev server uses), which breaks components like <Tabs> at render. Excluding
        // them from pre-bundling routes resolution through the dev server, which picks
        // the .web build correctly. Only the packages that actually ship a .web variant
        // need this; native-only primitives (avatar, slot, hooks) resolve identically
        // either way. Set via a spread so a future explicit exclude list can extend it.
        exclude: [
          '@rn-primitives/accordion',
          '@rn-primitives/checkbox',
          '@rn-primitives/dropdown-menu',
          '@rn-primitives/label',
          '@rn-primitives/popover',
          '@rn-primitives/select',
          '@rn-primitives/switch',
          '@rn-primitives/tabs',
          '@rn-primitives/toggle',
          '@rn-primitives/toggle-group',
          '@rn-primitives/tooltip',
        ],
        rolldownOptions: {
          moduleTypes: { '.mjs': 'jsx' },
          // Rolldown dep-optimizer runs independently and does NOT inherit viteFinal
          // plugins. Register the same strip transform here so it runs before
          // Rolldown's strict ESM binding analysis during pre-bundling.
          plugins: [
            {
              name: 'strip-rnui-type-reexports',
              transform: {
                filter: { id: { include: [/\/react-native-ui-lib\/src\//] } },
                handler(code: string, id: string) {
                  return { code: stripRnuiTypeReexports(code, id) ?? code }
                },
              },
            },
          ],
        },
      },
      define: {
        // Required by react-native-web
        __DEV__: JSON.stringify(true),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
      },
      // The production (rolldown) build does not run the dep-optimizer, so the
      // `.mjs: jsx` moduleType set under optimizeDeps above only fixes `storybook
      // dev`. The static `storybook build` bundles node_modules directly, where
      // rolldown treats `.js`/`.mjs` as plain JS and chokes on the JSX that the
      // RN ecosystem (react-native-ui-lib/src, @rn-primitives, expo-*) ships in
      // `.js`. Metro parses all `.js` as JSX; mirror that for the build.
      build: {
        rollupOptions: {
          moduleTypes: { '.js': 'jsx', '.mjs': 'jsx' },
        },
      },
    })
  },
}

export default config

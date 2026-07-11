// Pre-bundle the Card Mania DS entry into a single, JSX-free ESM module that the
// design-sync converter (lib/bundle.mjs) can re-wrap into window.CardMania.
//
// Why this exists: the converter's esbuild pass uses the default `.js` loader
// and no react-native aliasing, so it cannot bundle the RN ecosystem (JSX in
// `.js`/`.mjs`, `react-native` → `react-native-web`, native-module stubs). We do
// that bundling here — mirroring the repo's .storybook-web vite config — and
// leave react/react-dom EXTERNAL so the converter's react-global shim still binds
// them to the single window.React instance.
import { build } from 'esbuild'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { stripRnuiTypeReexports } from './rnui-strip.mjs'
// The converter's own react→window.React shim. Reusing it means CJS `require('react')`
// deep in react-native-web resolves to the single window.React the preview HTML
// provides, instead of a throwing dynamic-require. The output is self-contained.
import { reactShim } from '../.ds-sync/lib/bundle.mjs'

const root = resolve(import.meta.dirname, '..')
const stub = (p) => resolve(root, p)

// Mirror of .storybook-web/main.ts resolve.alias (order matters: deep RN
// internal paths before the bare react-native catch-all).
const aliases = [
  { re: /^react-native\/Libraries\/.*/, to: stub('lib/stubs/rn-internal.js') },
  { re: /^tailwind\.config$/, to: stub('tailwind.config.js') },
  { re: /^react-native$/, to: stub('lib/stubs/react-native-web-shim.mjs') },
  { re: /^@react-native-masked-view\/masked-view$/, to: stub('lib/stubs/masked-view.js') },
  { re: /^@react-native-community\/datetimepicker$/, to: stub('lib/stubs/datetimepicker.js') },
  { re: /^@shopify\/react-native-skia$/, to: stub('lib/stubs/react-native-skia.js') },
  { re: /^react-native-worklets$/, to: stub('lib/stubs/react-native-worklets.js') },
  { re: /^uilib-native(\/.*)?$/, to: stub('lib/stubs/uilib-native.js') },
  { re: /^react-native-reanimated$/, to: stub('lib/stubs/reanimated-web.ts') },
]

const rnBridge = {
  name: 'rn-web-bridge',
  setup(b) {
    // @/* → repo root (babel-plugin-module-resolver / tsconfig @ alias).
    b.onResolve({ filter: /^@\// }, (args) => {
      const rest = args.path.slice(2)
      const isFile = (p) => existsSync(p) && statSync(p).isFile()
      for (const ext of ['', '.web.tsx', '.web.ts', '.web.jsx', '.web.mjs', '.web.js', '.tsx', '.ts', '.jsx', '.mjs', '.js', '.json',
        '/index.web.tsx', '/index.web.ts', '/index.web.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']) {
        const p = stub(rest) + ext
        if (isFile(p)) return { path: p }
      }
      return { path: stub(rest) }
    })
    for (const { re, to } of aliases) {
      b.onResolve({ filter: re }, () => ({ path: to }))
    }
    // react-native-ui-lib's web optionalDependencies barrel omits exports for
    // deps it stubs out (Blur/DateTimePicker/Moment/SvgCssUri). esbuild ESM
    // binding analysis hard-errors on the missing names even though the
    // consuming components (card/modal/dateTimePicker) are unused here. Append
    // null stubs so the barrel resolves.
    b.onLoad({ filter: /react-native-ui-lib[/\\]src[/\\]optionalDependencies[/\\]index\.web\.js$/ }, (args) => {
      const code = readFileSync(args.path, 'utf8')
      const stubs = ['BlurViewPackage', 'DateTimePickerPackage', 'MomentPackage', 'SvgCssUri']
        .filter((n) => !new RegExp(`\\b${n}\\b`).test(code))
        .map((n) => `export const ${n} = null;`)
        .join('\n')
      return { contents: code + '\n' + stubs + '\n', loader: 'jsx' }
    })
    // Strip react-native-ui-lib type-only re-exports (mirror of the vite plugin).
    b.onLoad({ filter: /react-native-ui-lib[/\\]src[/\\].*\.js$/ }, (args) => {
      const code = readFileSync(args.path, 'utf8')
      return { contents: stripRnuiTypeReexports(code, args.path) ?? code, loader: 'jsx' }
    })
  },
}

await build({
  entryPoints: [resolve(root, '.design-sync/ds-entry.tsx')],
  outfile: resolve(root, '.design-sync/ds-prebundle.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  // The RN ecosystem ships JSX in .js/.mjs; treat them as jsx (Metro does too).
  loader: { '.js': 'jsx', '.mjs': 'jsx', '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.ttf': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
  // NativeWind's JSX runtime (react-native-css-interop) turns `className` into
  // real DOM classes on web, which the compiled Tailwind CSS then styles —
  // matching how the app renders. React's own runtime drops className, so
  // layout/spacing/typography classes would be lost.
  jsx: 'automatic',
  jsxImportSource: 'nativewind',
  // Web-first resolution so @rn-primitives/* and other platform files pick .web.
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.mjs', '.web.js', '.tsx', '.ts', '.jsx', '.mjs', '.js', '.json'],
  // Build in production mode: __DEV__ false dead-code-eliminates RN/Expo/Metro
  // dev machinery (HMR client, dev warnings) that otherwise runs at module load
  // and throws in a static browser bundle. EXPO_OS is normally inlined by
  // babel-preset-expo; set it to web. `global` → browser globalThis.
  define: {
    __DEV__: 'false',
    'process.env.NODE_ENV': '"production"',
    'process.env.EXPO_OS': '"web"',
    global: 'globalThis',
  },
  // Some RN deps read bare `process` (process.platform, process.env.*) at module
  // scope, which throws in the browser. Provide a minimal polyfill first.
  banner: {
    js:
      'globalThis.process=globalThis.process||{env:{NODE_ENV:"production"},platform:"web",cwd:function(){return"/"},nextTick:function(f){setTimeout(f,0)},argv:[],version:"",versions:{}};' +
      // react-native-web injects <style id="react-native-stylesheet"> into <head>.
      // The design-sync render check selects mounts via `[id^="r"]`, which wrongly
      // matches that <style> (empty innerHTML — RNW uses CSSOM insertRule) and
      // false-fails every multi-cell preview as rootEmpty. Rename it so it no
      // longer matches; RNW holds its own reference, so the rename is harmless.
      '(function(){if(typeof document==="undefined"||typeof MutationObserver==="undefined")return;var fix=function(){var s=document.getElementById("react-native-stylesheet");if(s)s.id="_rnw-sheet";};new MutationObserver(fix).observe(document.documentElement||document,{childList:true,subtree:true});fix();})();',
  },
  logLevel: 'warning',
  // reactShim resolves react/react-dom/react-is/scheduler to window.* so the
  // output is self-contained (no external/dynamic-require). rnBridge handles
  // @/, react-native → web, and native stubs.
  plugins: [reactShim, rnBridge],
})
console.error('prebundle written: .design-sync/ds-prebundle.mjs')

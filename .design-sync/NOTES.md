# Card Mania — design-sync notes

Card Mania is an **Expo / React Native + NativeWind** app, not a conventional web
design-system package. Getting it to sync to claude.ai/design required bridging
RN → web ourselves. Read this before re-syncing.

## Shape: `package` (not storybook)

We deliberately use `shape: "package"`, NOT the storybook shape, because the web
Storybook static build (`storybook:build-web` / `.storybook-web`) is non-functional
as a styled oracle:

- Vite 8 / rolldown production build won't parse JSX in node_modules `.js`/`.mjs`
  (the RN ecosystem ships JSX in `.js`). A `build.rollupOptions.moduleTypes` fix
  gets past that, but then:
- `react-native-ui-lib`/`expo-modules-core` web builds hit `[MISSING_EXPORT]`
  binding errors that rolldown rejects (esbuild tolerates them), and
- Tailwind/NativeWind CSS is **never wired into the vite build** (no PostCSS
  config; `@tailwind` stays literal) — so the reference would render unstyled.

So there is no faithful web Storybook render to compare against. Package shape
grades authored previews on an absolute rubric instead.

## The bundle bridge — `.design-sync/prebundle.mjs`

The converter's `lib/bundle.mjs` esbuild pass can't bundle RN source (no `.js`→jsx
loader, no `react-native` aliasing) and must not be forked. So we **pre-bundle**
the DS entry ourselves into a self-contained, JSX-free ESM module and feed it as
`cfg.entry` (`.design-sync/ds-prebundle.mjs`). `prebundle.mjs` mirrors the repo's
`.storybook-web/main.ts` vite setup:

- `.js`/`.mjs` → `jsx` loader (RN ships JSX in `.js`).
- **`jsxImportSource: 'nativewind'`** — THIS is what makes `className` styling work
  on web (react-native-css-interop forwards className to the DOM, where the
  compiled Tailwind CSS styles it). Without it, only inline `style` (rnui `Colors`)
  renders and all Tailwind layout/spacing/typography is lost. Verified visually.
- `react-native` → `lib/stubs/react-native-web-shim.mjs`; native-only modules
  (skia, worklets, reanimated, masked-view, datetimepicker, uilib-native) → the
  repo's existing `lib/stubs/*`; `react-native/Libraries/*` → `rn-internal.js`.
- `@/*` → repo root; web-first `resolveExtensions` (`.web.tsx` … first).
- `define: { global: 'globalThis' }` — RN/RNW reference the Node/RN `global`.
- react/react-dom kept out via the converter's own `reactShim` (imported from
  `.ds-sync/lib/bundle.mjs`) so there's one `window.React` — NOT esbuild `external`
  (that leaves throwing dynamic `require('react')` from CJS deps).
- `react-native-ui-lib/src` type-only re-exports stripped (`.design-sync/rnui-strip.mjs`,
  ported from the vite `stripRnuiTypeReexports`); `optionalDependencies/index.web.js`
  gets null stubs appended for `BlurViewPackage`/`DateTimePickerPackage`/`MomentPackage`/`SvgCssUri`.

**Re-sync must re-run `prebundle.mjs` before the converter** (it is the real
`dist` entry): `NODE_PATH=$(pwd)/.ds-sync/node_modules node .design-sync/prebundle.mjs`.

## CSS

`cfg.cssEntry` = `.design-sync/compiled.css`, produced by the Tailwind CLI from the
repo's `global.css`:
`DARK_MODE=class npx tailwindcss -i global.css -o .design-sync/compiled.css --config tailwind.config.js`
Re-run it when `global.css`, `tailwind.config.js`, or component classes change.

## Known render warns (triaged — not new on re-sync)

- `[TOKENS_MISSING]` (~130 vars: `--color-background-*` gluestack scale, `--radix-*`):
  non-blocking. These are defined in `compiled.css`/`_ds_bundle.css` under scoped
  selectors and/or set at runtime by components; the shipped previews render. Do not
  chase unless a preview visibly loses color.
- `rootEmpty` false-positive on multi-cell authored previews: FIXED by renaming
  RNW's injected `<style id="react-native-stylesheet">` in the prebundle banner (the
  render check's `[id^="r"]` selector matched it). If it recurs, that banner regressed.

## Prop contracts — `cfg.dtsPropsFor`

The pre-bundled entry is compiled JS (no types), so the converter can't extract prop
interfaces — every `<Name>.d.ts` came out as `[key: string]: unknown`, leaving the design
agent to guess props (this caused a real misuse: it built a broken Avatar on a Settings
page). Fixed by hand-writing `cfg.dtsPropsFor` for all shipped components (enums, required
props). **Keep these in sync with the component sources** — they are the agent's contract.

## Component status

- 10 authored previews graded good: Button, Badge, Chip, Text, Alert, Skeleton,
  SkeletonText, TabRow, CollapsibleSection, Tabs.
- **Avatar**: EXCLUDED from the sync (`componentSrcMap.Avatar: null`, not in `ds-entry.tsx`).
  Its `@rn-primitives/avatar` + gluestack styling doesn't render on web (no circular
  container) and it crashed the design agent when used. To re-add: wire the gluestack
  provider / `--color-*` tokens so the container renders, verify a preview with
  `AvatarImage` (image-error → fallback path), then restore the entry export + componentSrcMap.
- **CardListView**: floor card (deferred). Its subtree calls `useStores()` which needs
  a store Context provider; author a preview once a `cfg.provider` (or a mock store
  wrapper) is set up. Story fixture is in `stories/CardListItem.stories.tsx` (MOCK_CARD).
- **Tabs** preview is static (`value="vault"`, no-op `onValueChange`) — the component is
  controlled; the card shows the active pill only, which is the intended static view.

## Re-sync risks

- Everything under `.design-sync/` is hand-authored bridge code, not converter
  output — `prebundle.mjs`, `rnui-strip.mjs`, `ds-entry.tsx`, `ds.tsconfig.json`,
  `compiled.css`. If the app's dependencies (react-native-ui-lib, nativewind,
  react-native-web, react-native-css-interop) upgrade, the prebundle's shims may
  need updating. Re-run prebundle and watch for new `[MISSING_EXPORT]`/JSX errors.
- `compiled.css` is a build artifact checked for staleness by nothing — always
  recompile it on re-sync.
- Styling fidelity depends on `jsxImportSource: 'nativewind'`; if a re-sync shows
  unstyled/hugging layouts, that setting regressed.

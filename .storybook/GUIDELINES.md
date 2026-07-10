# Storybook Story Guidelines

## File location & naming

- All story files live in `stories/` at the repo root.
- One file per component (or tightly related family): `ComponentName.stories.tsx`.
- Use the `title` field to place stories into categories: `UI/Button`, `Cards/CardListItem`, etc.

```
stories/
  Button.stories.tsx          → title: 'UI/Button'
  TabsList.stories.tsx        → title: 'UI/Tabs'
  CardListItem.stories.tsx    → title: 'Cards/CardListItem'
```

---

## Required stories per component

Every story file must have at minimum:

| Story name | Purpose |
|---|---|
| `Default` | The most common, happy-path usage |
| `AllVariants` (or equivalent) | Every meaningful `variant`/`size` prop shown together |
| At least one "real data" story | Realistic mock values that look like actual app content |

Optional but strongly preferred:
- `Loading` / `Skeleton` — if the component has a loading state
- `Disabled` — if the component has a disabled state
- `Stacked` / `Group` — if the component is typically composed in a list

---

## Global providers (already wired in preview.tsx)

The Storybook global preview wraps every story with:

- `QueryClientProvider` (retry: false — prevents background network calls)
- `StoreProvider` (Zustand card store)
- `GestureHandlerRootView`

**Do not add these again inside story files or story-level decorators.**

Add to a story's `decorators` only when the component needs something *beyond* the global set (e.g. a navigation mock, a specific context provider).

---

## Mock data

- Declare mock data as top-level `const` objects, not inside render functions.
- Use realistic values — real field names, plausible card prices, actual set names.
- Cast with `as ComponentType` or `as any` only when necessary to satisfy generics on data shapes from Supabase.
- Include all *required* fields; use `null` or `undefined` for optional ones.

```tsx
// ✅ Good
const MOCK_CARD = {
  id: 'abc-123',
  name: 'Charizard',
  set_name: 'Base Set',
  latest_price: 485,
  ...
} as TCard

// ❌ Bad — lorem ipsum / placeholder data
const MOCK_CARD = { id: '1', name: 'Card Name', latest_price: 0 } as any
```

---

## What to avoid

| Avoid | Why |
|---|---|
| Importing from `@/client/` inside stories | These hit the network; use inline mock data instead |
| Adding `QueryClientProvider` / `StoreProvider` inside story files | Already in global preview — double-wrapping creates bugs |
| Stories with no visible output (empty render) | Defeats the purpose; add a placeholder if truly stateless |
| Real Supabase calls or `useEffect` data fetching | Stories must be self-contained with no async data loading |
| `console.error` suppressions | Fix the underlying prop type instead |

---

## Acceptance checklist

Before merging a new story:

- [ ] All story exports render without error in `npm run storybook:ios`
- [ ] The `Default` story shows the component with its most common configuration
- [ ] Variant/size props are showcased in an `AllVariants` story
- [ ] Mock data uses realistic values (real card names, real prices, real set names)
- [ ] Story title follows `Category/ComponentName` format
- [ ] No network calls or async data fetching inside stories

---

## Design system conformance

When adding stories for toggle/tab components, verify against the design system spec in `CLAUDE.md`:

- **Tab strips / segmented controls** — must use the pill container style (`TabsList`) not a flat underline unless the component is specifically `TabRow` (the underline variant for detail pages)
- **Spring animations** — verify the component uses one of the five established presets (`tab-slide`, `panel-entry`, `press-in`, `press-out`, `snap`) via a story that triggers the animation
- **Active segment color** — translucent tint (`Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35)`), not an opaque fill

If a component deviates from the design system, document why in a story comment.

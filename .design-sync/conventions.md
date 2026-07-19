# Card Mania UI — how to build with these components

Card Mania is a **React Native + Expo** app rendered on web via **react-native-web**.
Every component in this library is a real React Native component; on web it renders
to DOM. You compose them like ordinary React components — no special app wrapper is
required for them to be styled (the color tokens are built in).

## Styling idiom — two layers

Components are styled two ways, and you can use both:

1. **NativeWind `className`** (Tailwind utility classes) for **layout, spacing, sizing,
   radius, and typography**. Every component forwards `className`. Use standard Tailwind:
   - Layout: `flex-row`, `items-center`, `justify-between`, `gap-2`, `shrink-0`
   - Spacing/size: `px-4`, `py-2`, `min-h-10`, `size-8`, `w-full`
   - Shape/border: `rounded-md`, `rounded-full`, `border`, `shadow-sm`
   - Type: `text-sm`, `text-base`, `font-medium`, `font-bold`
   - Themed colors (CSS-var backed, from `tailwind.config.js`): `bg-primary`,
     `bg-secondary`, `text-foreground`, `border-input`, and the numbered scales
     `bg-background-0…950`, `text-typography-500`, etc.
2. **Inline `style`** (React Native style objects) for **one-off colors and geometry**,
   typically using react-native-ui-lib color tokens: `style={{ backgroundColor:
Colors.$backgroundPrimaryHeavy }}`. Prefer `className` for anything reusable.

Both `className` and `style` merge; `style` wins on conflicts.

## Components (import from the library global)

- **Button** — `variant`: default | primary | destructive | outline | secondary | ghost | link;
  `size`: default | sm | lg | icon. Children are text or an icon + text.
- **Text** — `variant`: h1–h4 | default | p | lead | large | small | muted | info | badge | stats.
  The typography primitive; use it for all copy.
- **Badge** / **Chip** — `label` string; Badge `variant`: default | square.
- **Alert** + **AlertTitle** + **AlertDescription** — `variant`: default | destructive;
  optional `icon`.
- **Avatar** + **AvatarFallback** + **AvatarFallbackText** + **AvatarImage** — `size`:
  xs | sm | md | lg | xl | 2xl.
- **CollapsibleSection** — `title`, optional `rightElement`, `defaultCollapsed`; children are rows.
- **Tabs** + **TabsList** + **TabsTrigger** + **TabsLabel** + **TabsContent** — controlled via
  `value` / `onValueChange`; a bordered pill segmented control.
- **TabRow** — lightweight segmented control: `options={[{value,label}]}`, `startingIdx`, `onValueChange`.
- **Skeleton** / **SkeletonView** and **SkeletonText** (`loading` prop) — loading placeholders.
- **CardListView** — a trading-card list row (`card` prop).

## Where the truth lives

Read `_ds/<folder>/styles.css` (and its `@import`s, incl. `_ds_bundle.css`) for the full
compiled utility-class + token vocabulary, and each component's `<Name>.d.ts` for its exact
props. The examples in each `<Name>.prompt.md` are real, verified compositions.

## Idiomatic snippet

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
  <Text variant="info">Pokémon • Base Set</Text>
  <Text variant="h3">Charizard Holo Rare 1st Edition</Text>
  <div style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
    <Badge label="PSA 10" />
    <Badge label="1st Edition" variant="square" />
  </div>
  <Button variant="primary">Buy Now</Button>
</div>
```

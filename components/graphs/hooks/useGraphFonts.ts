import { Skia, useTypeface, type SkFont } from '@shopify/react-native-skia'
import { useMemo } from 'react'

/**
 * All Skia fonts used across the price graph, derived from a single load of each
 * underlying typeface.
 *
 * Previously every graph component (PriceGraph, ToolTip, and one PointValueCard
 * *per series*) called `useFont(require('...ttf'), size)` independently. Each of
 * those fetches the .ttf asset over the Metro dev server, and when many fire at
 * once one occasionally resolves before its bytes are ready — Skia then throws
 * `Expected arraybuffer as first parameter`. Loading each typeface exactly once
 * here and deriving the sized fonts with `Skia.Font(typeface, size)` removes the
 * concurrent-fetch race.
 */
export type GraphFonts = {
  /** Inter @ 11 — axis tick labels. */
  axis: SkFont | null
  /** Inter @ 12 — tooltip x-value label. */
  tooltip: SkFont | null
  /** SpaceMono @ 12 — PointValueCard value text. */
  price: SkFont | null
  /** SpaceMono @ 10 — PointValueCard series label. */
  label: SkFont | null
}

export function useGraphFonts(): GraphFonts {
  const inter = useTypeface(require('../../../assets/fonts/Inter.ttf'))
  const spaceMono = useTypeface(require('../../../assets/fonts/SpaceMono-Regular.ttf'))

  return useMemo(
    () => ({
      axis: inter ? Skia.Font(inter, 11) : null,
      tooltip: inter ? Skia.Font(inter, 12) : null,
      price: spaceMono ? Skia.Font(spaceMono, 12) : null,
      label: spaceMono ? Skia.Font(spaceMono, 10) : null,
    }),
    [inter, spaceMono]
  )
}

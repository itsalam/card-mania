/**
 * Canonical grade price keys — the TypeScript twin of SQL `public.normalize_grade_key`
 * (migration 20261025000000). Keys in `cards.grades_prices` and `card_price_history.grade`
 * are `<company slug><whole>[_<decimal>]` or `ungraded`:
 *
 *   "PSA 10", "psa_10", "psa10.0" → "psa10"
 *   "BGS 9.5", "bgs_9.5", "bgs9_5" → "bgs9_5"
 *   "Raw", "ungraded"             → "ungraded"
 *
 * Idempotent. Unrecognised keys pass through unchanged (as the SQL helper does) so nothing
 * is silently dropped. The database also normalises on write, so this keeps data clean
 * before it gets there rather than being the only line of defence.
 */
export function canonicalGradeKey(labelOrKey: string): string {
  const trimmed = labelOrKey.trim().toLowerCase()
  if (trimmed === 'raw' || trimmed === 'ungraded') return 'ungraded'
  const m = trimmed.match(/^([a-z]+)[\s_]*(\d+)(?:[._](\d+))?$/)
  if (!m) return labelOrKey
  const dec = (m[3] ?? '').replace(/0+$/, '')
  return `${m[1]}${Number(m[2])}${dec ? `_${dec}` : ''}`
}

/** Rebuilds a grades_prices map with canonical keys (later entries win on collision). */
export function canonicalGradesPrices(gp: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [key, val] of Object.entries(gp)) result[canonicalGradeKey(key)] = val
  return result
}

// ITS-40: decides whether a vendor search result is actually the card the
// backfill job queried for, before its image gets committed to that card.
//
// The backfill queries vendors by the card's own name + set, then commits a
// result's image to the card and marks it terminal (enriched_at). A wrong
// image is never revisited, so it's worse than none — this gate rejects
// results that don't clearly name the card, and picks the best-matching
// result rather than the first one with an image.
//
// Scoring is token coverage of the card's fields within the result's text
// (name + set_name, since vendors fold set/number/grade into titles
// inconsistently). Name coverage dominates; set coverage mostly breaks ties
// between printings. Among equal scores, the result with fewer extra name
// tokens wins, so a base card ("Shohei Ohtani #1") prefers the base result
// over a parallel ("Shohei Ohtani [Foilfractor] #1") that also covers it.
// Dependency-free so it's unit-testable without the edge-runtime import map.

export type MatchTarget = { name: string; set_name?: string | null }
export type MatchCandidate = { card: { name?: string | null; set_name?: string | null } }

const NAME_WEIGHT = 0.75
const SET_WEIGHT = 0.25
// Catalog set names carry a genre prefix ("Baseball Cards 2025 Topps") that
// vendor titles rarely repeat; they'd only dilute set coverage.
const SET_STOPWORDS = new Set(['card', 'cards', 'trading', 'tcg'])

export function matchTokens(s: string | null | undefined): string[] {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Fraction of `needles` tokens present in `haystack` (1 when there are no needles). */
function coverage(needles: string[], haystack: Set<string>) {
  if (!needles.length) return 1
  return needles.filter((t) => haystack.has(t)).length / needles.length
}

/** 0..1 score for how well `candidate` names `target`. */
export function scoreMatch(target: MatchTarget, candidate: MatchCandidate) {
  const haystack = new Set([
    ...matchTokens(candidate.card.name),
    ...matchTokens(candidate.card.set_name),
  ])
  const nameTokens = matchTokens(target.name)
  if (!nameTokens.length) return 0
  const setTokens = matchTokens(target.set_name).filter((t) => !SET_STOPWORDS.has(t))
  return NAME_WEIGHT * coverage(nameTokens, haystack) + SET_WEIGHT * coverage(setTokens, haystack)
}

/** Candidate name tokens not in the target's name/set — the tie-breaker. */
function extraTokens(target: MatchTarget, candidate: MatchCandidate) {
  const known = new Set([...matchTokens(target.name), ...matchTokens(target.set_name)])
  return matchTokens(candidate.card.name).filter((t) => !known.has(t)).length
}

/**
 * Highest-scoring candidate at or above `threshold`, among those `eligible`
 * (e.g. results that carry an image). Ties go to fewer extra name tokens,
 * then vendor rank order.
 */
export function pickBestMatch<T extends MatchCandidate>(
  target: MatchTarget,
  candidates: T[],
  threshold: number,
  eligible: (c: T) => boolean = () => true
): { best: T; score: number } | null {
  let best: { best: T; score: number; extra: number } | null = null
  for (const c of candidates) {
    if (!eligible(c)) continue
    const score = scoreMatch(target, c)
    if (score < threshold) continue
    const extra = extraTokens(target, c)
    if (!best || score > best.score || (score === best.score && extra < best.extra))
      best = { best: c, score, extra }
  }
  return best && { best: best.best, score: best.score }
}

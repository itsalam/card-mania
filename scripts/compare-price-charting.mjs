// scripts/compare-price-charting.mjs
// ITS-40 regression check: snapshot the live price-charting search function's
// output for a fixed set of queries, then diff two snapshots (e.g. main vs. a
// branch that refactors the vendor helpers). No automated test covers
// price-charting, so this is the before/after check for changes to it.
//
// Usage (against LOCAL Supabase only — each query calls real vendors and
// bumps search_queries hit counts):
//   git checkout main && supabase functions serve --env-file <vendor keys>
//   LOCAL_SERVICE_ROLE=... node scripts/compare-price-charting.mjs snapshot /tmp/main.json
//   git checkout <branch>   (functions serve hot-reloads)
//   LOCAL_SERVICE_ROLE=... node scripts/compare-price-charting.mjs snapshot /tmp/branch.json
//   node scripts/compare-price-charting.mjs diff /tmp/main.json /tmp/branch.json
//
// Take both snapshots back-to-back: vendor prices/listings drift over time, so
// price-only differences are reported separately from structural ones
// (which vendor/policy answered, which cards, in what order, image kind).

import { readFileSync, writeFileSync } from 'node:fs'

const { LOCAL_URL = 'http://127.0.0.1:54321', LOCAL_SERVICE_ROLE } = process.env

// Aim for one query per blend branch; the snapshot prints which policy each
// query actually hit so you can swap queries until every branch is covered.
const QUERIES = [
  { label: 'local-strong', params: { q: 'Shohei Ohtani 2025 Topps' } },
  { label: 'cardhedge', params: { q: 'Michael Jordan 1986 Fleer 57' } },
  { label: 'pricecharting', params: { q: 'Charizard Base Set Unlimited' } },
  { label: 'ebay', params: { q: 'Bo Nix 2024 Panini Prizm Silver Rookie' } },
  { label: 'empty-query', params: { q: '' } },
  { label: 'marketplace', params: { q: '', scope: 'marketplace' } },
]

const [mode, ...args] = process.argv.slice(2)

if (mode === 'snapshot') await snapshot(args[0])
else if (mode === 'diff') diff(args[0], args[1])
else {
  console.error('Usage: compare-price-charting.mjs snapshot <out.json> | diff <a.json> <b.json>')
  process.exit(1)
}

async function snapshot(out) {
  if (!out || !LOCAL_SERVICE_ROLE) throw new Error('Need <out.json> and LOCAL_SERVICE_ROLE')
  const snap = {}
  for (const { label, params } of QUERIES) {
    const url = new URL(`${LOCAL_URL}/functions/v1/price-charting`)
    for (const [k, v] of Object.entries({
      limit: '10',
      skipCache: 'true',
      skipCacheUpsert: 'true',
      ...params,
    }))
      url.searchParams.set(k, v)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${LOCAL_SERVICE_ROLE}`, apikey: LOCAL_SERVICE_ROLE },
    })
    const body = await res.json().catch(() => ({}))
    const results = (body.results ?? []).map(shape)
    snap[label] = { status: res.status, query: body.query ?? null, results }
    const policies = [...new Set(results.map((r) => r.policy))].join(',') || '-'
    console.log(
      `${label.padEnd(14)} ${res.status}  ${String(results.length).padStart(2)} results  policy=${policies}`
    )
  }
  writeFileSync(out, JSON.stringify(snap, null, 2))
  console.log(`wrote ${out}`)
}

function shape(r) {
  return {
    rank: r.rank,
    source: r.source,
    vendor: r.reason?.vendor ?? null,
    policy: r.reason?.policy ?? null,
    name: r.card?.name,
    set_name: r.card?.set_name,
    image_kind: r.card?.image?.kind ?? null,
    has_image_url: Boolean(r.card?.image?.url),
    score: r.score,
    latest_price: r.card?.latest_price ?? null,
  }
}

function diff(aPath, bPath) {
  const a = JSON.parse(readFileSync(aPath, 'utf8'))
  const b = JSON.parse(readFileSync(bPath, 'utf8'))
  let structural = 0
  for (const label of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const ra = a[label]
    const rb = b[label]
    if (!ra || !rb) {
      console.log(`✗ ${label}: only in ${ra ? aPath : bPath}`)
      structural++
      continue
    }
    const issues = []
    const prices = []
    if (ra.status !== rb.status) issues.push(`status ${ra.status} → ${rb.status}`)
    if (ra.results.length !== rb.results.length)
      issues.push(`result count ${ra.results.length} → ${rb.results.length}`)
    const n = Math.min(ra.results.length, rb.results.length)
    for (let i = 0; i < n; i++) {
      const { latest_price: pa, ...sa } = ra.results[i]
      const { latest_price: pb, ...sb } = rb.results[i]
      for (const k of Object.keys(sa))
        if (JSON.stringify(sa[k]) !== JSON.stringify(sb[k]))
          issues.push(`#${i + 1} ${k}: ${JSON.stringify(sa[k])} → ${JSON.stringify(sb[k])}`)
      if (pa !== pb) prices.push(`#${i + 1} ${pa} → ${pb}`)
    }
    structural += issues.length ? 1 : 0
    console.log(
      `${issues.length ? '✗' : '✓'} ${label}${prices.length ? `  (price drift: ${prices.join(', ')})` : ''}`
    )
    for (const msg of issues) console.log(`    ${msg}`)
  }
  console.log(
    structural ? `\n${structural} quer(ies) differ structurally` : '\nNo structural differences'
  )
  process.exit(structural ? 1 : 0)
}

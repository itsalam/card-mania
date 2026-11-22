/**
 * Search tuning (ITS-57): edit public.search_config and preview how a query reranks before saving.
 *
 * Layout: grouped, labelled settings on the left with a query-and-results panel beside them, as
 * in Exa's API playground (Mobbin 6ae0c177-16f1-4ecd-84f3-7ea73e39c9fe); the side-by-side
 * "try it on a sample" preview follows WRITER's voice tuner (Mobbin
 * b48fded6-b609-42b0-865a-3ea87bbe3a15).
 *
 * Data: admin.search_config_get / update_search_config / preview_search_config
 * (supabase/migrations/20261122000000_its57_search_config_admin.sql). Field meanings come from
 * docs/search-scoring.md. Saved values reach the app as each query's 5-minute search cache expires.
 */
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useGetSearchConfig, usePreviewSearchConfig, useUpdateSearchConfig } from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import type { FnResult } from '../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { ArrowDown, ArrowUp, Loader2, Minus, Play, RefreshCw } from 'lucide-react'
import { cn } from '../lib/shadcn/utils'

type FieldKind = 'numeric' | 'integer' | 'text[]'
type FieldSpec = { field: string; kind: FieldKind; min: number; max: number }
type Changes = Record<string, number | string[]>

type FieldInfo = { label: string; hint: string }
type Group = { title: string; hint?: string; fields: string[] }

// Copy from docs/search-scoring.md (the config reference table).
const INFO: Partial<Record<string, FieldInfo>> = {
  weight_fts: { label: 'Full-text', hint: 'Favors exact or near-exact name and set matches.' },
  weight_trgm: { label: 'Fuzzy (trigram)', hint: 'Forgives typos and partial queries.' },
  weight_vector: { label: 'Semantic', hint: 'No effect yet: there is no embedding signal.' },
  weight_pop: { label: 'Popularity', hint: 'Lifts popular cards even on weaker text matches.' },
  pop_wishlist_weight: { label: 'Wishlist share', hint: 'How much "people want this" counts.' },
  pop_sale_weight: { label: 'Sales share', hint: 'How much completed sales count.' },
  pop_log_divisor: { label: 'Saturation', hint: 'Higher needs more wishlists or sales before popularity maxes out.' },
  trgm_word_similarity_threshold: { label: 'Fuzzy match threshold', hint: 'Used by collection search. Higher cuts noisy fuzzy matches.' },
  min_score: { label: 'Minimum score', hint: 'Results scoring at or below this are dropped.' },
  snippet_max_words: { label: 'Snippet max words', hint: 'Cosmetic. Doesn\'t affect ranking.' },
  snippet_min_words: { label: 'Snippet min words', hint: 'Must be less than max words.' },
  snippet_max_fragments: { label: 'Snippet fragments', hint: 'Highlighted fragments per snippet.' },
  prefetch_threshold_ms: { label: 'Prefetch threshold (ms)', hint: 'Prefetch turns on when p75 render time is above this. Checked hourly.' },
  suggestion_queries: { label: 'Suggested searches', hint: 'One per line. One is shown and pre-warmed each hour, in turn.' },
}

const GROUPS: Group[] = [
  { title: 'Ranking weights', hint: 'score = Σ weight × signal. Usually kept summing to about 1; only the ratios change the order.', fields: ['weight_fts', 'weight_trgm', 'weight_vector', 'weight_pop'] },
  { title: 'Popularity', fields: ['pop_wishlist_weight', 'pop_sale_weight', 'pop_log_divisor'] },
  { title: 'Matching', fields: ['min_score', 'trgm_word_similarity_threshold'] },
  { title: 'Snippets', fields: ['snippet_max_words', 'snippet_min_words', 'snippet_max_fragments'] },
  { title: 'Suggestions and prefetch', fields: ['suggestion_queries', 'prefetch_threshold_ms'] },
]

const WEIGHTS = ['weight_fts', 'weight_trgm', 'weight_vector', 'weight_pop']

type Row = { [K in 'config' | 'fields' | 'history' | 'current' | 'proposed']?: unknown }
type ResultRow = { rank: number; other_rank: number | null; id: string; name: string; set_name: string | null; score: number }
type HistoryRow = { id: number; created_at: string; actor_email: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null }

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function toText(kind: FieldKind, value: unknown): string {
  if (kind === 'text[]') return Array.isArray(value) ? value.map(String).join('\n') : ''
  return value == null ? '' : String(value)
}

/** Parses a draft into a value, or an error message. */
function parse(spec: FieldSpec, text: string): { value: number | string[] } | { error: string } {
  if (spec.kind === 'text[]') {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < spec.min || lines.length > spec.max) return { error: `${spec.min}–${spec.max} lines` }
    if (lines.some((l) => l.length > 100)) return { error: 'Each line up to 100 characters' }
    return { value: lines }
  }
  const t = text.trim()
  if (!/^-?\d*\.?\d+$/.test(t)) return { error: 'Enter a number' }
  const n = Number(t)
  if (spec.kind === 'integer' && !Number.isInteger(n)) return { error: 'Whole number' }
  if (n < spec.min || n > spec.max) return { error: `${spec.min}–${spec.max}` }
  return { value: n }
}

function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i])
  return Number(a) === Number(b)
}

function when(value: string): string {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function short(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} queries`
  return value == null ? '—' : String(value)
}

// ── Pieces ─────────────────────────────────────────────────────────────────────────────────────
function FieldRow({ spec, text, saved, error, onChange }: { spec: FieldSpec; text: string; saved: unknown; error: string | undefined; onChange: (text: string) => void }) {
  const info = INFO[spec.field]
  const dirty = !error && 'value' in parse(spec, text) && !same((parse(spec, text) as { value: unknown }).value, saved)
  const id = `field-${spec.field}`
  return (
    <div className={cn('grid gap-2 py-3 sm:grid-cols-[1fr_11rem] sm:items-start', spec.kind === 'text[]' && 'sm:grid-cols-1')}>
      <div>
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-foreground">
          {info?.label ?? spec.field}
          {dirty ? <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="changed" /> : null}
        </label>
        <div className="text-xs text-muted-foreground">
          {info?.hint} <span className="font-mono">{spec.field}</span>
        </div>
      </div>
      <div>
        {spec.kind === 'text[]' ? (
          <textarea
            id={id}
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        ) : (
          <Input id={id} value={text} inputMode="decimal" onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} className={cn('h-8 text-right tabular-nums', error && 'border-red-500')} />
        )}
        {error ? <div className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</div> : null}
      </div>
    </div>
  )
}

function Movement({ rank, other }: { rank: number; other: number | null }) {
  if (other == null) return <span className="text-xs font-medium text-primary">new</span>
  if (other === rank) return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-label="same rank" />
  const up = rank < other
  return (
    <span className={cn('inline-flex items-center text-xs tabular-nums', up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
      {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {Math.abs(other - rank)}
    </span>
  )
}

function ResultList({ title, rows, showMovement }: { title: string; rows: ResultRow[]; showMovement: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No results.</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{r.rank}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-foreground">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.set_name ?? ''}</div>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Number(r.score).toFixed(3)}</span>
              {showMovement ? (
                <span className="w-8 shrink-0 text-right">
                  <Movement rank={r.rank} other={r.other_rank} />
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────────────────────
export default function SearchTuning() {
  const { accessToken, callAdmin } = useAuth()
  const signedIn = accessToken !== null
  const { trigger: triggerGet } = useGetSearchConfig()
  const { trigger: triggerUpdate } = useUpdateSearchConfig()
  const { trigger: triggerPreview } = usePreviewSearchConfig()

  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [specs, setSpecs] = useState<FieldSpec[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<{ current: ResultRow[]; proposed: ResultRow[]; query: string } | null>(null)

  const reset = useCallback((cfg: Record<string, unknown>, fieldSpecs: FieldSpec[]) => {
    setDrafts(Object.fromEntries(fieldSpecs.map((s) => [s.field, toText(s.kind, cfg[s.field])])))
  }, [])

  const load = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    setError(null)
    const res = (await callAdmin((token) => triggerGet({ accessToken: token }))) as FnResult | undefined
    setLoading(false)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not load the search config.')
      return
    }
    const data = asRecord(res.data) as Row
    const cfg = asRecord(data.config)
    const fieldSpecs = asList<FieldSpec>(data.fields)
    setConfig(cfg)
    setSpecs(fieldSpecs)
    setHistory(asList<HistoryRow>(data.history))
    reset(cfg, fieldSpecs)
    setQuery((q) => q || (Array.isArray(cfg['suggestion_queries']) ? String(cfg['suggestion_queries'][0] ?? '') : ''))
  }, [signedIn, callAdmin, triggerGet, reset])

  useEffect(() => {
    void load()
  }, [load])

  const specByField = useMemo(() => new Map(specs.map((s) => [s.field, s])), [specs])

  // Parsed drafts: per-field errors, and the changes against the saved values.
  const { errors, changes } = useMemo(() => {
    const errs: Record<string, string> = {}
    const ch: Changes = {}
    for (const spec of specs) {
      const parsed = parse(spec, drafts[spec.field] ?? '')
      if ('error' in parsed) errs[spec.field] = parsed.error
      else if (config && !same(parsed.value, config[spec.field])) ch[spec.field] = parsed.value
    }
    const min = ch['snippet_min_words'] ?? config?.['snippet_min_words']
    const max = ch['snippet_max_words'] ?? config?.['snippet_max_words']
    if (!errs['snippet_min_words'] && Number(min) >= Number(max)) errs['snippet_min_words'] = 'Must be less than max words'
    return { errors: errs, changes: ch }
  }, [specs, drafts, config])

  const changeCount = Object.keys(changes).length
  const hasErrors = Object.keys(errors).length > 0

  const weightSum = useMemo(
    () => WEIGHTS.reduce((sum, f) => sum + (Number(changes[f] ?? config?.[f]) || 0), 0),
    [changes, config],
  )

  const runPreview = async () => {
    if (!query.trim() || hasErrors) return
    setPreviewing(true)
    setError(null)
    const res = (await callAdmin((token) => triggerPreview({ accessToken: token, query: query.trim(), changes, limit: 15 }))) as FnResult | undefined
    setPreviewing(false)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not preview this query.')
      return
    }
    const data = asRecord(res.data) as Row
    setPreview({ current: asList<ResultRow>(data.current), proposed: asList<ResultRow>(data.proposed), query: query.trim() })
  }

  const save = async () => {
    if (!changeCount || hasErrors) return
    setSaving(true)
    setError(null)
    setNotice(null)
    const trimmed = reason.trim()
    const res = (await callAdmin((token) =>
      triggerUpdate(trimmed ? { accessToken: token, changes, reason: trimmed } : { accessToken: token, changes }),
    )) as FnResult | undefined
    setSaving(false)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not save.')
      return
    }
    setReason('')
    setNotice('Saved. Searches pick it up as their 5-minute cache entries expire.')
    void load()
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Search tuning</CardTitle>
          <CardDescription>How card search ranks results on staging. Preview a query before saving; every save is in the audit log.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Reload
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {notice ? (
          <Alert>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        {!config ? (
          <div className="flex justify-center py-12">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <p className="text-sm text-muted-foreground">Nothing loaded.</p>}
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              {GROUPS.map((g) => (
                <section key={g.title}>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                    {g.title === 'Ranking weights' ? (
                      <span className={cn('text-xs tabular-nums', Math.abs(weightSum - 1) > 0.05 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                        Sum {weightSum.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                  {g.hint ? <p className="text-xs text-muted-foreground">{g.hint}</p> : null}
                  <div className="divide-y divide-border">
                    {g.fields.map((f) => {
                      const spec = specByField.get(f)
                      return spec ? (
                        <FieldRow
                          key={f}
                          spec={spec}
                          text={drafts[f] ?? ''}
                          saved={config[f]}
                          error={errors[f]}
                          onChange={(text) => setDrafts((d) => ({ ...d, [f]: text }))}
                        />
                      ) : null
                    })}
                  </div>
                </section>
              ))}
              <p className="text-xs text-muted-foreground">
                Prefetch is {config['prefetch_enabled'] ? 'on' : 'off'} right now (set hourly from render times, not editable here).
              </p>
            </div>

            <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
              <section className="space-y-3 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Preview</h3>
                  <p className="text-xs text-muted-foreground">Ranks a query with the saved values and with your edits. Nothing is saved.</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                    onKeyDown={(e: { key: string }) => {
                      if (e.key === 'Enter') void runPreview()
                    }}
                    placeholder="Search query"
                    aria-label="Preview query"
                    className="h-9"
                  />
                  <Button size="sm" onClick={() => void runPreview()} disabled={!query.trim() || hasErrors || previewing}>
                    {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Preview
                  </Button>
                </div>
                {preview ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ResultList title="Saved" rows={preview.current} showMovement={false} />
                    <ResultList title={changeCount ? 'With your edits' : 'With your edits (none yet)'} rows={preview.proposed} showMovement />
                  </div>
                ) : null}
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{changeCount ? `${changeCount} unsaved ${changeCount === 1 ? 'change' : 'changes'}` : 'No unsaved changes'}</h3>
                  {changeCount ? (
                    <Button variant="ghost" size="sm" onClick={() => reset(config, specs)} disabled={saving}>
                      Discard
                    </Button>
                  ) : null}
                </div>
                {changeCount ? (
                  <ul className="space-y-0.5 text-xs">
                    {Object.entries(changes).map(([f, v]) => (
                      <li key={f} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{INFO[f]?.label ?? f}</span>
                        <span className="tabular-nums text-foreground">
                          {short(config[f])} → {short(v)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Input value={reason} onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)} placeholder="Why (optional, kept in the audit log)" aria-label="Reason" className="h-9" />
                <Button className="w-full" onClick={() => void save()} disabled={!changeCount || hasErrors || saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Recent changes</h3>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes from the console yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((h) => {
                      const after = h.after ?? {}
                      const why = typeof after['reason'] === 'string' ? after['reason'] : null
                      return (
                        <li key={h.id} className="rounded-md border border-border px-3 py-2 text-xs">
                          <div className="flex justify-between gap-2 text-muted-foreground">
                            <span>{h.actor_email ?? 'SQL'}</span>
                            <span>{when(h.created_at)}</span>
                          </div>
                          {why ? <div className="mt-1 text-foreground">“{why}”</div> : null}
                          <ul className="mt-1 space-y-0.5">
                            {Object.keys(after).filter((k) => k !== 'reason').map((k) => (
                              <li key={k} className="flex justify-between gap-2">
                                <span className="text-muted-foreground">{INFO[k]?.label ?? k}</span>
                                <span className="tabular-nums text-foreground">
                                  {short(h.before?.[k])} → {short(after[k])}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

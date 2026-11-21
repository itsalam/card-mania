/**
 * Pipelines (ITS-117 part 2): price refresh, enrichment backfill and notifications, one tab each.
 *
 * Each tab is a KPI row over the backlog, an outcome table, recent runs, and a spot-check list of
 * the weakest results — the stat-row-over-table layout of n8n's insights
 * (eba468af-e216-4772-a50d-9d30f96d12ad) and Fingerprint's overview
 * (217e2393-6e1d-45cb-a592-6b84dee0e2ec) on Refero.
 *
 * Data: admin.price_refresh_overview / queue_card_price_refresh / enrichment_overview /
 * notification_overview (supabase/migrations/20261120000000_its117_ops_pipelines.sql).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  useGetEnrichmentOverview,
  useGetNotificationOverview,
  useGetPriceRefreshOverview,
  useQueueCardPriceRefresh,
} from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import type { FnResult } from '../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { Check, Loader2, RefreshCw, RotateCw } from 'lucide-react'
import { cn } from '../lib/shadcn/utils'

type Tab = 'price' | 'enrichment' | 'notifications'
type Row = Record<string, unknown>

const TABS: { value: Tab; label: string }[] = [
  { value: 'price', label: 'Price refresh' },
  { value: 'enrichment', label: 'Enrichment' },
  { value: 'notifications', label: 'Notifications' },
]

// ── Formatting ──────────────────────────────────────────────────────────────────────────────────
function n(value: unknown): string {
  if (value == null) return '—'
  const num = Number(value)
  return Number.isFinite(num) ? num.toLocaleString() : String(value)
}

function score(value: unknown): string {
  if (value == null) return '—'
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(2) : '—'
}

function when(value: unknown): string {
  if (typeof value !== 'string') return '—'
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function list(value: unknown): Row[] {
  return Array.isArray(value) ? (value.filter((v) => v && typeof v === 'object') as Row[]) : []
}

function obj(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
}

const BAD_STATUS = new Set(['failed', 'error', 'rate_limited'])

function Status({ value }: { value: unknown }) {
  const s = typeof value === 'string' ? value : '—'
  return <span className={cn(BAD_STATUS.has(s) ? 'font-medium text-red-600 dark:text-red-400' : 'text-foreground')}>{s}</span>
}

function Kpi({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-xl font-semibold tabular-nums', bad ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      {children}
    </div>
  )
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h, i) => (
              <TableHead key={h} className={cn(i > 0 && 'text-right')}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={head.length} className="py-6 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((cells, r) => (
              <TableRow key={r}>
                {cells.map((c, i) => (
                  <TableCell key={i} className={cn('text-sm', i > 0 && 'text-right tabular-nums')}>
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────────────────────────
function PriceRefresh({ data, onQueue, queued, queueing }: { data: Row; onQueue: (cardId: string) => void; queued: Set<string>; queueing: string | null }) {
  const b = obj(data.backlog)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Tracked cards" value={n(b.tracked_cards)} sub="in someone's collection" />
        <Kpi label="Due for refresh" value={n(b.stale)} />
        <Kpi label="Unresolved" value={n(b.unresolved)} sub="no CardHedger match yet" />
        <Kpi label="Refreshed (24h)" value={n(b.refreshed_24h)} sub={`${n(b.claimed_24h)} claimed`} />
        <Kpi label="Runs (24h)" value={n(b.runs)} sub={`${n(b.completed)} completed`} />
        <Kpi label="Rate limited (24h)" value={n(b.rate_limited)} bad={Number(b.rate_limited) > 0} />
        <Kpi label="Leased now" value={n(b.leased_now)} />
        <Kpi label="Last run" value={when(b.last_run_at)} sub={typeof b.last_run_status === 'string' ? b.last_run_status : undefined} bad={BAD_STATUS.has(String(b.last_run_status))} />
      </div>

      <Section title="Outcomes (7 days)" hint="Per card attempt. Confidence is the CardHedger match score.">
        <SimpleTable
          head={['Outcome', 'Attempts', 'Avg confidence', 'P10 confidence']}
          empty="No attempts in 7 days."
          rows={list(data.outcomes).map((o) => [<Status key="s" value={o.outcome} />, n(o.attempts), score(o.avg_confidence), score(o.p10_confidence)])}
        />
      </Section>

      <Section title="Weakest matches (7 days)" hint="Prices taken from a fuzzy match, lowest confidence first. Queue a card to have it re-checked on the next run (:07 or :37).">
        <SimpleTable
          head={['Card', 'Matched as', 'Confidence', '']}
          empty="No fuzzy matches in 7 days."
          rows={list(data.low_confidence).map((r) => {
            const id = String(r.card_id)
            return [
              <div key="c">
                <div className="font-medium text-foreground">{String(r.name ?? '')}</div>
                <div className="text-xs text-muted-foreground">{String(r.set_name ?? '')} · {String(r.outcome)}</div>
              </div>,
              <span key="m" className="text-muted-foreground">{String(r.matched_description ?? '—')}</span>,
              score(r.match_confidence),
              queued.has(id) ? (
                <span key="q" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5" /> Queued
                </span>
              ) : (
                <Button key="q" variant="ghost" size="sm" disabled={queueing === id} onClick={() => onQueue(id)}>
                  {queueing === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                  Refresh
                </Button>
              ),
            ]
          })}
        />
      </Section>

      <Section title="Recent runs">
        <SimpleTable
          head={['Started', 'Status', 'Claimed', 'Refreshed', 'Unchanged', 'Unresolved', 'Failed']}
          empty="No runs recorded."
          rows={list(data.runs).map((r) => [
            <div key="w">
              <div>{when(r.started_at)}</div>
              {r.error ? <div className="max-w-[20rem] truncate text-xs text-red-600 dark:text-red-400" title={String(r.error)}>{String(r.error)}</div> : null}
            </div>,
            <Status key="s" value={r.status} />,
            n(r.claimed),
            n(r.refreshed),
            n(r.unchanged),
            n(r.unresolved),
            n(r.failed),
          ])}
        />
      </Section>
    </div>
  )
}

function Enrichment({ data }: { data: Row }) {
  const b = obj(data.backlog)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Not enriched" value={n(b.unenriched)} sub={b.est_days_remaining != null ? `~${n(b.est_days_remaining)} days at this rate` : undefined} />
        <Kpi label="Enriched (24h)" value={n(b.enriched_24h_all_paths)} sub="all paths" />
        <Kpi label="Backfill runs (24h)" value={n(b.backfill_runs_24h)} sub={`${n(b.backfill_failed_runs_24h)} failed`} bad={Number(b.backfill_failed_runs_24h) > 0} />
        <Kpi label="Last run" value={when(b.last_run_at)} sub={typeof b.last_run_status === 'string' ? b.last_run_status : undefined} bad={BAD_STATUS.has(String(b.last_run_status))} />
        <Kpi label="Backfill enriched (24h)" value={n(b.backfill_enriched_24h)} sub={`${n(b.backfill_claimed_24h)} claimed`} />
        <Kpi label="No match (24h)" value={n(b.backfill_no_match_24h)} />
        <Kpi label="Card failures (24h)" value={n(b.backfill_card_failures_24h)} bad={Number(b.backfill_card_failures_24h) > 0} />
        <Kpi label="Leases" value={n(b.leased_now)} sub={`${n(b.stale_leases)} stale`} bad={Number(b.stale_leases) > 0} />
      </div>

      <Section title="Vendor outcomes (7 days)" hint="Scores are the best image-match score per attempt.">
        <SimpleTable
          head={['Vendor · outcome', 'Attempts', 'Avg score', 'P10', 'P50']}
          empty="No attempts in 7 days."
          rows={list(data.vendor_outcomes).map((o) => [
            <span key="v">
              {String(o.vendor)} · <Status value={o.outcome} />
            </span>,
            n(o.attempts),
            score(o.avg_score),
            score(o.p10_score),
            score(o.p50_score),
          ])}
        />
      </Section>

      <Section title="Lowest-scoring image hits (7 days)" hint="The likeliest wrong pictures. Check them against the card.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list(data.low_score_hits).length === 0 ? (
            <p className="text-sm text-muted-foreground">No image hits in 7 days.</p>
          ) : (
            list(data.low_score_hits).map((h, i) => (
              <div key={i} className="flex gap-3 rounded-md border border-border p-2">
                {typeof h.image_url === 'string' ? (
                  <img src={h.image_url} alt="" className="h-20 w-14 shrink-0 rounded object-cover" loading="lazy" />
                ) : (
                  <div className="h-20 w-14 shrink-0 rounded bg-muted" />
                )}
                <div className="min-w-0 text-xs">
                  <div className="truncate text-sm font-medium text-foreground">{String(h.name ?? '')}</div>
                  <div className="truncate text-muted-foreground">{String(h.set_name ?? '')}</div>
                  <div className="mt-1 truncate text-muted-foreground" title={String(h.matched_title ?? '')}>
                    Matched: {String(h.matched_title ?? '—')}
                  </div>
                  <div className="text-muted-foreground">
                    {String(h.vendor)} · score {score(h.best_score)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

      <Section title="Recent runs">
        <SimpleTable
          head={['Started', 'Status', 'Claimed', 'Enriched', 'No match', 'Failed']}
          empty="No runs recorded."
          rows={list(data.runs).map((r) => [
            <div key="w">
              <div>{when(r.started_at)}</div>
              {r.error ? <div className="max-w-[20rem] truncate text-xs text-red-600 dark:text-red-400" title={String(r.error)}>{String(r.error)}</div> : null}
            </div>,
            <Status key="s" value={r.status} />,
            n(r.claimed),
            n(r.enriched),
            n(r.no_match),
            n(r.failed),
          ])}
        />
      </Section>
    </div>
  )
}

function Notifications({ data }: { data: Row }) {
  const w = obj(data.wishlist_hits)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Wishlist hits, individual" value={n(w.individual)} />
        <Kpi label="Wishlist hits, summaries" value={n(w.summary)} sub="one per user over the cap" />
        <Kpi label="Dedupe table rows" value={n(w.dedupe_rows)} sub={`${n(w.dedupe_seeded)} seeded`} />
        <Kpi label="Since" value={when(data.since)} />
      </div>
      <Section title="Volume by type">
        <SimpleTable
          head={['Type · category', 'Sent', 'Users', 'Read', 'Dismissed', 'Last sent']}
          empty="No notifications in this window."
          rows={list(data.by_type).map((t) => [
            <span key="t">
              <span className="font-mono text-xs text-foreground">{String(t.type)}</span>
              <span className="text-muted-foreground"> · {String(t.category ?? '—')}</span>
            </span>,
            n(t.sent),
            n(t.users),
            n(t.read),
            n(t.dismissed),
            when(t.last_sent),
          ])}
        />
      </Section>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────────────────────
export default function Pipelines() {
  const { accessToken, callAdmin } = useAuth()
  const signedIn = accessToken !== null
  const { trigger: triggerPrice } = useGetPriceRefreshOverview()
  const { trigger: triggerEnrichment } = useGetEnrichmentOverview()
  const { trigger: triggerNotifications } = useGetNotificationOverview()
  const { trigger: triggerQueue } = useQueueCardPriceRefresh()

  const [tab, setTab] = useState<Tab>('price')
  const [hours, setHours] = useState(168)
  const [data, setData] = useState<Partial<Record<Tab, Row>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState<Set<string>>(new Set())
  const [queueing, setQueueing] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    setError(null)
    const res = (await callAdmin((token) =>
      tab === 'price'
        ? triggerPrice({ accessToken: token })
        : tab === 'enrichment'
          ? triggerEnrichment({ accessToken: token })
          : triggerNotifications({ accessToken: token, hours }),
    )) as FnResult | undefined
    setLoading(false)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not load this pipeline.')
      return
    }
    setData((prev) => ({ ...prev, [tab]: obj(res.data) }))
  }, [signedIn, callAdmin, tab, hours, triggerPrice, triggerEnrichment, triggerNotifications])

  useEffect(() => {
    void load()
  }, [load])

  const queue = async (cardId: string) => {
    setQueueing(cardId)
    setError(null)
    const res = (await callAdmin((token) => triggerQueue({ accessToken: token, cardId }))) as FnResult | undefined
    setQueueing(null)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not queue the refresh.')
      return
    }
    setQueued((prev) => new Set(prev).add(cardId))
  }

  const current = data[tab]

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Pipelines</CardTitle>
          <CardDescription>Background work on staging: price refresh, image enrichment and notifications.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'notifications' ? (
            <div className="flex gap-1" role="tablist" aria-label="Time window">
              {[
                [24, '24 hours'],
                [168, '7 days'],
                [720, '30 days'],
              ].map(([h, label]) => (
                <button
                  key={h}
                  type="button"
                  role="tab"
                  aria-selected={hours === h}
                  onClick={() => setHours(Number(h))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    hours === h ? 'border-transparent bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="inline-flex rounded-full border border-border p-1" role="tablist" aria-label="Pipeline">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm transition-colors',
                tab === t.value ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!current ? (
          <div className="flex justify-center py-12">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <p className="text-sm text-muted-foreground">Nothing loaded.</p>}
          </div>
        ) : tab === 'price' ? (
          <PriceRefresh data={current} onQueue={(id) => void queue(id)} queued={queued} queueing={queueing} />
        ) : tab === 'enrichment' ? (
          <Enrichment data={current} />
        ) : (
          <Notifications data={current} />
        )}
      </CardContent>
    </Card>
  )
}

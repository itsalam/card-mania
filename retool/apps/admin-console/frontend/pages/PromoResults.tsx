/**
 * Promo results (ITS-194): how each promo box performs over a date range.
 *
 * Layout follows analytics dashboards on Refero: a range control above a KPI row, one chart
 * card, then a per-item table (Visitors cc387687-640c-4506-ae3c-ef2982861751, Fingerprint
 * 217e2393-6e1d-45cb-a592-6b84dee0e2ec, Missive's sortable performance table
 * 30b695eb-c152-498c-abe1-a8c45fb039e8). Selecting a row in the table drives the chart.
 *
 * Numbers come from admin.promo_results / admin.promo_results_daily
 * (supabase/migrations/20261117000000_its194_promo_results.sql). Dates are UTC days.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useGetPromoResults, useGetPromoResultsDaily } from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import type { FnResult } from '../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { ArrowDown, Info, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '../lib/shadcn/utils'
import { PhaseChip } from './Promos'
import { PLACEMENTS, TEMPLATES } from '../utils/promo'
import type { Phase, Placement, Template } from '../utils/promo'

type ResultRow = {
  promo_id: string
  slug: string
  title: string
  template: Template
  placement: Placement
  status: string
  phase: Phase
  impressions: number
  taps: number
  tap_rate: number | null
  viewers: number
  tappers: number
  wishlist_adds: number
  card_views: number
  offers: number
  converted_users: number
  conversion_rate: number | null
}

type DailyRow = { day: string; impressions: number; taps: number }

type Preset = 7 | 30 | 90
type SortKey = 'impressions' | 'taps' | 'tap_rate' | 'converted_users' | 'conversion_rate'

const PRESETS: Preset[] = [7, 30, 90]

const COLUMNS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'impressions', label: 'Impressions', hint: 'App sessions that showed the box' },
  { key: 'taps', label: 'Taps', hint: 'App sessions that tapped it' },
  { key: 'tap_rate', label: 'Tap rate', hint: 'Taps ÷ impressions' },
  { key: 'converted_users', label: 'Converted', hint: 'Signed-in tappers who wishlisted, viewed or offered on a covered card within 7 days' },
  { key: 'conversion_rate', label: 'Conv. rate', hint: 'Converted ÷ signed-in tappers' },
]

/** YYYY-MM-DD for a UTC day, `offset` days from today. */
function utcDay(offset = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function pct(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`
}

function num(value: number): string {
  return value.toLocaleString()
}

function shortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

export default function PromoResults() {
  const navigate = useNavigate()
  const { accessToken, callAdmin } = useAuth()
  const signedIn = accessToken !== null
  const { trigger: triggerResults } = useGetPromoResults()
  const { trigger: triggerDaily } = useGetPromoResultsDaily()

  const [preset, setPreset] = useState<Preset | 'custom'>(30)
  const [from, setFrom] = useState(utcDay(-29))
  const [to, setTo] = useState(utcDay(0))

  const [rows, setRows] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('impressions')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [daily, setDaily] = useState<DailyRow[]>([])
  const [dailyLoading, setDailyLoading] = useState(false)

  const pickPreset = (days: Preset) => {
    setPreset(days)
    setFrom(utcDay(-(days - 1)))
    setTo(utcDay(0))
  }

  const rangeValid = Boolean(from && to && from <= to)

  const load = useCallback(async () => {
    if (!signedIn || !rangeValid) return
    setLoading(true)
    setError(null)
    const res = (await callAdmin((token) => triggerResults({ accessToken: token, from, to }))) as FnResult | undefined
    setLoading(false)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not load promo results.')
      return
    }
    const next = Array.isArray(res.data) ? (res.data as ResultRow[]) : []
    setRows(next)
    // Keep the selection if it's still listed, else chart the top promo.
    setSelectedId((current) =>
      current && next.some((r) => r.promo_id === current) ? current : (next[0]?.promo_id ?? null),
    )
  }, [signedIn, rangeValid, callAdmin, triggerResults, from, to])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!signedIn || !selectedId || !rangeValid) {
      setDaily([])
      return
    }
    let cancelled = false
    setDailyLoading(true)
    void (async () => {
      const res = (await callAdmin((token) =>
        triggerDaily({ accessToken: token, promoId: selectedId, from, to }),
      )) as FnResult | undefined
      if (cancelled) return
      setDailyLoading(false)
      setDaily(res?.ok && Array.isArray(res.data) ? (res.data as DailyRow[]) : [])
    })()
    return () => {
      cancelled = true
    }
  }, [signedIn, selectedId, rangeValid, callAdmin, triggerDaily, from, to])

  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => ({
        impressions: acc.impressions + r.impressions,
        taps: acc.taps + r.taps,
        tappers: acc.tappers + r.tappers,
        converted: acc.converted + r.converted_users,
      }),
      { impressions: 0, taps: 0, tappers: 0, converted: 0 },
    )
    return {
      ...t,
      tapRate: t.impressions > 0 ? t.taps / t.impressions : null,
      convRate: t.tappers > 0 ? t.converted / t.tappers : null,
    }
  }, [rows])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1)),
    [rows, sort],
  )

  const selected = rows.find((r) => r.promo_id === selectedId) ?? null
  const chartData = useMemo(() => daily.map((d) => ({ ...d, label: shortDay(d.day) })), [daily])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Promo results</CardTitle>
            <CardDescription>How each promo box performs. Days are UTC; today is up to an hour behind.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1" role="tablist" aria-label="Date range">
              {PRESETS.map((days) => (
                <button
                  key={days}
                  type="button"
                  role="tab"
                  aria-selected={preset === days}
                  onClick={() => pickPreset(days)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    preset === days
                      ? 'border-transparent bg-primary/15 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {days} days
                </button>
              ))}
            </div>
            <Input
              type="date"
              aria-label="From"
              className="h-8 w-[9.5rem]"
              value={from}
              max={to}
              onChange={(e) => {
                setPreset('custom')
                setFrom(e.target.value)
              }}
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="To"
              className="h-8 w-[9.5rem]"
              value={to}
              min={from}
              max={utcDay(0)}
              onChange={(e) => {
                setPreset('custom')
                setTo(e.target.value)
              }}
            />
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || !rangeValid}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!rangeValid ? (
            <Alert variant="destructive">
              <AlertDescription>The start date must be on or before the end date.</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Impressions" value={num(totals.impressions)} sub="app sessions" />
            <Kpi label="Taps" value={num(totals.taps)} sub="app sessions" />
            <Kpi label="Tap rate" value={pct(totals.tapRate)} />
            <Kpi
              label="Conversion rate"
              value={pct(totals.convRate)}
              sub={`${num(totals.converted)} of ${num(totals.tappers)} signed-in tappers`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{selected ? selected.title : 'Daily impressions and taps'}</CardTitle>
          <CardDescription>
            {selected ? 'Daily impressions and taps. Pick another promo in the table below.' : 'Pick a promo in the table below.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative h-64">
            {dailyLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : null}
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="impressions" name="Impressions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="taps" name="Taps" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : !dailyLoading ? (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                No promo selected.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">By promo</CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Conversions count signed-in users only, within 7 days of their first tap, on cards the promo covers
            right now. Card views are a lower bound: the app keeps only each user's latest view of a card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {loading ? 'Loading results…' : 'No live promos and no promo traffic in this range.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Promo</TableHead>
                    {COLUMNS.map((c) => (
                      <TableHead key={c.key} className="text-right" title={c.hint}>
                        <button
                          type="button"
                          onClick={() => setSort(c.key)}
                          className={cn(
                            'inline-flex items-center gap-1 whitespace-nowrap',
                            sort === c.key ? 'text-foreground' : 'hover:text-foreground',
                          )}
                        >
                          {c.label}
                          {sort === c.key ? <ArrowDown className="h-3 w-3" /> : null}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="text-right" title="Wishlist adds · card views · offers">
                      Wishlist · views · offers
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow
                      key={r.promo_id}
                      className={cn('cursor-pointer', r.promo_id === selectedId && 'bg-accent/60')}
                      onClick={() => setSelectedId(r.promo_id)}
                      aria-selected={r.promo_id === selectedId}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="font-medium text-foreground hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/promos/${r.promo_id}`)
                            }}
                          >
                            {r.title}
                          </button>
                          <PhaseChip phase={r.phase} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {TEMPLATES.find((t) => t.value === r.template)?.label} ·{' '}
                          {PLACEMENTS.find((p) => p.value === r.placement)?.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.impressions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.taps)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(r.tap_rate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(r.converted_users)}
                        <span className="text-xs text-muted-foreground"> / {num(r.tappers)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{pct(r.conversion_rate)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                        {num(r.wishlist_adds)} · {num(r.card_views)} · {num(r.offers)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

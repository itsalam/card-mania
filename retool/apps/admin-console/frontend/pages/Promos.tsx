import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListPromos } from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import type { FnResult } from '../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { Loader2, Plus, RefreshCw } from 'lucide-react'
import { cn } from '../lib/shadcn/utils'
import { PHASES, PHASE_CLASS, PLACEMENTS, TEMPLATES, formatDateTime } from '../utils/promo'
import type { Phase, PromoListRow } from '../utils/promo'

type PhaseFilter = 'all' | Phase

export function PhaseChip({ phase }: { phase: Phase }) {
  const label = PHASES.find((p) => p.value === phase)?.label ?? phase
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', PHASE_CLASS[phase])}>
      {label}
    </span>
  )
}

function windowLabel(row: PromoListRow): string {
  if (!row.starts_at && !row.ends_at) return 'Always on'
  if (row.starts_at && row.ends_at) return `${formatDateTime(row.starts_at)} → ${formatDateTime(row.ends_at)}`
  if (row.starts_at) return `From ${formatDateTime(row.starts_at)}`
  return `Until ${formatDateTime(row.ends_at)}`
}

export default function Promos() {
  const navigate = useNavigate()
  const { accessToken, callAdmin } = useAuth()
  const signedIn = accessToken !== null
  const { trigger } = useListPromos()

  const [rows, setRows] = useState<PromoListRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<PhaseFilter>('all')

  const includeArchived = phase === 'archived'

  const load = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    setError(null)
    const res = (await callAdmin((token) => trigger({ accessToken: token, includeArchived }))) as FnResult | undefined
    setLoading(false)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not load promos.')
      return
    }
    setRows(Array.isArray(res.data) ? (res.data as PromoListRow[]) : [])
  }, [signedIn, callAdmin, trigger, includeArchived])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const c: Partial<Record<Phase, number>> = {}
    for (const r of rows) c[r.phase] = (c[r.phase] ?? 0) + 1
    return c
  }, [rows])

  const visible = phase === 'all' ? rows : rows.filter((r) => r.phase === phase)

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Promo boxes</CardTitle>
          <CardDescription>Cards on the app's Home feed: product releases and announcements.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => navigate('/promos/new')}>
            <Plus className="w-4 h-4" />
            New promo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
          {(['all', ...PHASES.map((p) => p.value)] as PhaseFilter[]).map((value) => {
            const label = value === 'all' ? 'All' : PHASES.find((p) => p.value === value)?.label
            const count = value === 'all' ? rows.filter((r) => r.phase !== 'archived').length : counts[value as Phase]
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={phase === value}
                onClick={() => setPhase(value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  phase === value
                    ? 'border-transparent bg-primary/15 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {count && value !== 'archived' ? <span className="ml-1.5 text-xs text-muted-foreground">{count}</span> : null}
              </button>
            )
          })}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {visible.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading promos…' : phase === 'all' ? 'No promos yet.' : 'No promos with this status.'}
            </p>
            {!loading && phase === 'all' ? (
              <Button className="mt-4" size="sm" onClick={() => navigate('/promos/new')}>
                <Plus className="w-4 h-4" />
                Create the first one
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/promos/${row.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{row.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {TEMPLATES.find((t) => t.value === row.template)?.label} · {row.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PhaseChip phase={row.phase} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {PLACEMENTS.find((p) => p.value === row.placement)?.label}
                      {row.priority ? <span className="text-muted-foreground"> · priority {row.priority}</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{windowLabel(row)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(row.updated_at)}
                      {row.updated_by_email ? <div className="text-xs">{row.updated_by_email}</div> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

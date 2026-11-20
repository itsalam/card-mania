/**
 * Client errors (ITS-117): the app's public.client_errors, grouped by context, with a
 * drill-down into the individual errors (user and metadata).
 *
 * Grouped list with counts and last seen, and a detail list for the selected group, as in
 * issue-tracker views (Linear grouped list 58ac6637-2009-4f3e-86c3-382b0dbfd942, Zapier run
 * history dc8c8d9a-0ca4-46c6-906f-9b9e2cdcadfa).
 *
 * Data: admin.client_error_groups / list_client_errors
 * (supabase/migrations/20261118000001_its117_ops_jobs_errors.sql).
 */
import { useCallback, useEffect, useState } from 'react'
import { useGetClientErrorGroups, useListClientErrors } from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import type { FnResult } from '../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '../lib/shadcn/utils'

type Group = {
  context: string
  errors: number
  users: number
  first_seen: string
  last_seen: string
  latest_message: string | null
}

type ErrorRow = {
  id: number
  created_at: string
  context: string
  message: string
  metadata: Record<string, unknown> | null
  user_id: string | null
  user_email: string | null
}

const WINDOWS = [
  { hours: 24, label: '24 hours' },
  { hours: 24 * 7, label: '7 days' },
  { hours: 24 * 30, label: '30 days' },
] as const

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ClientErrors() {
  const { accessToken, callAdmin } = useAuth()
  const signedIn = accessToken !== null
  const { trigger: triggerGroups } = useGetClientErrorGroups()
  const { trigger: triggerList } = useListClientErrors()

  const [hours, setHours] = useState<number>(24)
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<string | null>(null)
  const [rows, setRows] = useState<ErrorRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    setError(null)
    const res = (await callAdmin((token) => triggerGroups({ accessToken: token, hours }))) as FnResult | undefined
    setLoading(false)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not load client errors.')
      return
    }
    const next = Array.isArray(res.data) ? (res.data as Group[]) : []
    setGroups(next)
    setContext((current) => (current && next.some((g) => g.context === current) ? current : (next[0]?.context ?? null)))
  }, [signedIn, callAdmin, triggerGroups, hours])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!signedIn || !context) {
      setRows([])
      return
    }
    let cancelled = false
    setRowsLoading(true)
    void (async () => {
      const res = (await callAdmin((token) => triggerList({ accessToken: token, context, hours, limit: 100 }))) as
        | FnResult
        | undefined
      if (cancelled) return
      setRowsLoading(false)
      setRows(res?.ok && Array.isArray(res.data) ? (res.data as ErrorRow[]) : [])
    })()
    return () => {
      cancelled = true
    }
  }, [signedIn, context, hours, callAdmin, triggerList])

  const total = groups.reduce((n, g) => n + g.errors, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Client errors</CardTitle>
            <CardDescription>
              Errors the app reported, grouped by where they happened. {total > 0 ? `${total.toLocaleString()} in this window.` : ''}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1" role="tablist" aria-label="Time window">
              {WINDOWS.map((w) => (
                <button
                  key={w.hours}
                  type="button"
                  role="tab"
                  aria-selected={hours === w.hours}
                  onClick={() => setHours(w.hours)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    hours === w.hours
                      ? 'border-transparent bg-primary/15 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Context</TableHead>
                  <TableHead>Latest message</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      {loading ? 'Loading errors…' : 'No client errors in this window.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((g) => (
                    <TableRow
                      key={g.context}
                      className={cn('cursor-pointer', g.context === context && 'bg-accent/60')}
                      onClick={() => setContext(g.context)}
                    >
                      <TableCell className="font-mono text-xs text-foreground">{g.context}</TableCell>
                      <TableCell className="max-w-[28rem] truncate text-sm text-muted-foreground" title={g.latest_message ?? ''}>
                        {g.latest_message}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{g.errors.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{g.users.toLocaleString()}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground">{dateTime(g.last_seen)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {context ? (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="font-mono text-base">{context}</CardTitle>
            <CardDescription>Latest 100 in this window. Open one for its metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            {rowsLoading && rows.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {rows.map((r) => {
                  const open = openId === r.id
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent/30"
                        onClick={() => setOpenId(open ? null : r.id)}
                        aria-expanded={open}
                      >
                        {open ? (
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-foreground">{r.message}</div>
                          <div className="text-xs text-muted-foreground">
                            {dateTime(r.created_at)} · {r.user_email ?? (r.user_id ? r.user_id : 'signed out')}
                          </div>
                        </div>
                      </button>
                      {open ? (
                        <div className="space-y-2 bg-muted/40 px-9 py-3">
                          <div className="whitespace-pre-wrap break-words text-xs text-foreground">{r.message}</div>
                          <pre className="max-h-64 overflow-auto rounded border border-border bg-background p-2 text-xs">
                            {r.metadata ? JSON.stringify(r.metadata, null, 2) : 'No metadata'}
                          </pre>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

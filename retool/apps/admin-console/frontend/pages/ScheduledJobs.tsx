/**
 * Scheduled jobs (ITS-117): every pg_cron job, whether it's healthy, and pause/resume.
 *
 * A status strip on top (Zendesk status page 7957c520-682f-4b22-ba1d-d86b77ed661c), a job list
 * with each one's last result and an on/off action (n8n workflows 5c904898-3fc9-4e98-8103-5c7a23bb24f2),
 * and the selected job's run history underneath (Zapier run history
 * dc8c8d9a-0ca4-46c6-906f-9b9e2cdcadfa).
 *
 * "Healthy" also looks at the HTTP answer of jobs that call an edge function: pg_cron marks
 * those runs 'succeeded' as soon as the request is queued, even when the function answers 401.
 * Data: admin.list_cron_jobs / cron_job_history / set_cron_job_active
 * (supabase/migrations/20261118000001_its117_ops_jobs_errors.sql).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGetCronJobHistory, useListCronJobs, useSetCronJobActive } from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import type { FnResult } from '../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../lib/shadcn/alert-dialog'
import { Loader2, Pause, Play, RefreshCw } from 'lucide-react'
import { cn } from '../lib/shadcn/utils'

type Job = {
  jobid: number
  jobname: string
  schedule: string
  active: boolean
  kind: 'http' | 'sql'
  function: string | null
  last_run_at: string | null
  last_run_status: string | null
  last_run_message: string | null
  last_run_ms: number | null
  runs_24h: number
  failed_runs_24h: number
  http_tracked: boolean
  last_http_at: string | null
  last_http_status: string | null
  last_http_error: string | null
  http_failed_6h: number
  http_total_6h: number
  healthy: boolean | null
}

type Run = { runid: number; start_time: string; end_time: string | null; status: string; return_message: string | null }
type Request = {
  request_id: number
  created_at: string
  status_code: number | null
  timed_out: boolean | null
  error_msg: string | null
  content: string | null
  responded_at: string | null
}
type History = { jobname: string; function: string | null; runs: Run[]; requests: Request[] }

type Health = 'failing' | 'healthy' | 'paused'

function health(job: Job): Health {
  if (!job.active) return 'paused'
  return job.healthy === false ? 'failing' : 'healthy'
}

const HEALTH_DOT: Record<Health, string> = {
  failing: 'bg-red-500',
  healthy: 'bg-green-500',
  paused: 'bg-muted-foreground/50',
}

const HEALTH_LABEL: Record<Health, string> = { failing: 'Failing', healthy: 'Healthy', paused: 'Paused' }

function ago(iso: string | null): string {
  if (!iso) return '—'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${Math.max(s, 0)}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

function dateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

function httpLabel(job: Job): { text: string; bad: boolean } {
  if (job.kind !== 'http') return { text: '—', bad: false }
  if (!job.http_tracked) return { text: 'not tracked', bad: false }
  if (!job.last_http_status) return { text: 'no recent request', bad: false }
  const bad = job.last_http_status !== 'pending' && !/^2\d\d$/.test(job.last_http_status)
  return { text: job.last_http_status, bad }
}

function requestStatus(r: Request): { text: string; bad: boolean } {
  if (r.status_code == null && !r.timed_out && !r.error_msg) return { text: 'pending', bad: false }
  if (r.timed_out) return { text: 'timeout', bad: true }
  if (r.error_msg) return { text: 'error', bad: true }
  const code = r.status_code ?? 0
  return { text: String(code), bad: code < 200 || code >= 300 }
}

export default function ScheduledJobs() {
  const { accessToken, callAdmin } = useAuth()
  const signedIn = accessToken !== null
  const { trigger: triggerList } = useListCronJobs()
  const { trigger: triggerHistory } = useGetCronJobHistory()
  const { trigger: triggerActive } = useSetCronJobActive()

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [pendingPause, setPendingPause] = useState<Job | null>(null)
  const [busyJob, setBusyJob] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    setError(null)
    const res = (await callAdmin((token) => triggerList({ accessToken: token }))) as FnResult | undefined
    setLoading(false)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not load scheduled jobs.')
      return
    }
    setJobs(Array.isArray(res.data) ? (res.data as Job[]) : [])
  }, [signedIn, callAdmin, triggerList])

  useEffect(() => {
    void load()
  }, [load])

  const loadHistory = useCallback(
    async (jobname: string) => {
      setHistoryLoading(true)
      const res = (await callAdmin((token) => triggerHistory({ accessToken: token, jobname, limit: 30 }))) as FnResult | undefined
      setHistoryLoading(false)
      setHistory(res?.ok ? (res.data as History) : null)
    },
    [callAdmin, triggerHistory],
  )

  useEffect(() => {
    if (!selected || !signedIn) {
      setHistory(null)
      return
    }
    void loadHistory(selected)
  }, [selected, signedIn, loadHistory])

  const counts = useMemo(() => {
    const c: Record<Health, number> = { failing: 0, healthy: 0, paused: 0 }
    for (const j of jobs) c[health(j)] += 1
    return c
  }, [jobs])

  const setActive = async (job: Job, active: boolean) => {
    setBusyJob(job.jobname)
    setError(null)
    // Flip the row at once; the next load reconciles health.
    setJobs((prev) => prev.map((j) => (j.jobname === job.jobname ? { ...j, active } : j)))
    const res = (await callAdmin((token) => triggerActive({ accessToken: token, jobname: job.jobname, active }))) as
      | FnResult
      | undefined
    setBusyJob(null)
    if (!res?.ok) {
      setJobs((prev) => prev.map((j) => (j.jobname === job.jobname ? job : j)))
      setError(res?.message ?? `Could not ${active ? 'resume' : 'pause'} ${job.jobname}.`)
      return
    }
    void load()
  }

  const selectedJob = jobs.find((j) => j.jobname === selected) ?? null
  const tracked = jobs.some((j) => j.http_tracked)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Scheduled jobs</CardTitle>
            <CardDescription>
              pg_cron jobs on staging. Jobs that call an edge function are also judged by the function’s answer, not just by
              cron’s “succeeded”.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {jobs.length > 0 && !tracked ? (
            <Alert>
              <AlertDescription>
                Edge-function responses aren’t being tracked on this project, so HTTP failures (like a 401 from a wrong
                edge_token) won’t show here. See docs/admin-console.md § Scheduled jobs.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            {(['failing', 'healthy', 'paused'] as Health[]).map((h) => (
              <div key={h} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                <span className={cn('h-2.5 w-2.5 rounded-full', HEALTH_DOT[h])} />
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-foreground">{counts[h]}</div>
                  <div className="text-xs text-muted-foreground">{HEALTH_LABEL[h]}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead className="text-right">Failed / runs (24h)</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      {loading ? 'Loading jobs…' : 'No scheduled jobs.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => {
                    const h = health(j)
                    const http = httpLabel(j)
                    return (
                      <TableRow
                        key={j.jobname}
                        className={cn('cursor-pointer', j.jobname === selected && 'bg-accent/60')}
                        onClick={() => setSelected(j.jobname === selected ? null : j.jobname)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', HEALTH_DOT[h])} title={HEALTH_LABEL[h]} />
                            <span className="font-medium text-foreground">{j.jobname}</span>
                          </div>
                          {j.function ? <div className="pl-4 text-xs text-muted-foreground">edge function {j.function}</div> : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{j.schedule}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <span className={cn(j.last_run_status === 'failed' && 'font-medium text-red-600 dark:text-red-400')}>
                            {j.last_run_status ?? 'never'}
                          </span>
                          <span className="text-muted-foreground"> · {ago(j.last_run_at)}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <span className={cn(http.bad ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                            {http.text}
                          </span>
                          {j.kind === 'http' && j.http_total_6h > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {' '}
                              · {j.http_failed_6h}/{j.http_total_6h} failed (6h)
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          <span className={cn(j.failed_runs_24h > 0 && 'text-red-600 dark:text-red-400')}>{j.failed_runs_24h}</span>
                          <span className="text-muted-foreground"> / {j.runs_24h}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyJob === j.jobname}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (j.active) setPendingPause(j)
                              else void setActive(j, true)
                            }}
                          >
                            {busyJob === j.jobname ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : j.active ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            {j.active ? 'Pause' : 'Resume'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedJob ? (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">{selectedJob.jobname}</CardTitle>
            <CardDescription>
              {selectedJob.last_http_error ? (
                <span className="text-red-600 dark:text-red-400">Last error: {selectedJob.last_http_error}</span>
              ) : selectedJob.last_run_message ? (
                <>Last message: {selectedJob.last_run_message}</>
              ) : (
                'Recent runs and edge-function responses.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading && !history ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : history ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Cron runs</div>
                  <ul className="divide-y divide-border rounded-md border border-border text-sm">
                    {history.runs.length === 0 ? (
                      <li className="px-3 py-6 text-center text-muted-foreground">No runs recorded.</li>
                    ) : (
                      history.runs.map((r) => (
                        <li key={r.runid} className="flex items-start gap-3 px-3 py-2">
                          <span
                            className={cn(
                              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                              r.status === 'failed' ? 'bg-red-500' : r.status === 'succeeded' ? 'bg-green-500' : 'bg-amber-500',
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between gap-2">
                              <span className="text-foreground">{r.status}</span>
                              <span className="whitespace-nowrap text-xs text-muted-foreground">{dateTime(r.start_time)}</span>
                            </div>
                            {r.return_message ? (
                              <div className="truncate text-xs text-muted-foreground" title={r.return_message}>
                                {r.return_message}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Edge-function responses {history.function ? `(${history.function}, last ~6h)` : ''}
                  </div>
                  <ul className="divide-y divide-border rounded-md border border-border text-sm">
                    {!history.function ? (
                      <li className="px-3 py-6 text-center text-muted-foreground">This job runs SQL only.</li>
                    ) : history.requests.length === 0 ? (
                      <li className="px-3 py-6 text-center text-muted-foreground">No tracked requests.</li>
                    ) : (
                      history.requests.map((r) => {
                        const st = requestStatus(r)
                        return (
                          <li key={r.request_id} className="flex items-start gap-3 px-3 py-2">
                            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', st.bad ? 'bg-red-500' : st.text === 'pending' ? 'bg-amber-500' : 'bg-green-500')} />
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between gap-2">
                                <span className={cn(st.bad ? 'font-medium text-red-600 dark:text-red-400' : 'text-foreground')}>{st.text}</span>
                                <span className="whitespace-nowrap text-xs text-muted-foreground">{dateTime(r.created_at)}</span>
                              </div>
                              {st.bad && (r.error_msg || r.content) ? (
                                <div className="truncate text-xs text-muted-foreground" title={r.error_msg ?? r.content ?? ''}>
                                  {r.error_msg ?? r.content}
                                </div>
                              ) : null}
                            </div>
                          </li>
                        )
                      })
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Could not load the history.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog
        open={pendingPause !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPause(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause {pendingPause?.jobname}?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops running on staging until someone resumes it. The pause is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const job = pendingPause
                setPendingPause(null)
                if (job) void setActive(job, false)
              }}
            >
              Pause
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

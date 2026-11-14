import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useGetPromo,
  useIssuePreviewToken,
  useLookupCards,
  usePreviewPromoMatches,
  useRestorePromoRevision,
  useSetPromoStatus,
  useUpsertPromo,
} from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import type { FnResult } from '../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Textarea } from '../lib/shadcn/textarea'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Spinner } from '../lib/shadcn/spinner'
import { Archive, ArrowLeft, Check, EyeOff, Loader2, RotateCcw, Save, Send } from 'lucide-react'
import { cn } from '../lib/shadcn/utils'
import { PhaseChip } from './Promos'
import { SetPicker } from '../components/promo/SetPicker'
import { CardSearch } from '../components/promo/CardSearch'
import { HeroUpload } from '../components/promo/HeroUpload'
import { MatchPreview } from '../components/promo/MatchPreview'
import { PhonePreview } from '../components/promo/PhonePreview'
import { RevisionHistory } from '../components/promo/RevisionHistory'
import { useDebounced } from '../utils/useDebounced'
import { APP_PREVIEW_BASE_URL } from '../config'
import {
  ACCENTS,
  BADGES,
  ORDER_BY,
  PLACEMENTS,
  TEMPLATES,
  cleanFilter,
  formatDateTime,
  fromApi,
  fromLocalInput,
  hasCardCriteria,
  newPromo,
  publishLabel,
  toLocalInput,
  toPayload,
} from '../utils/promo'
import type { Badge, CardRef, CtaKind, Filter, MatchPreview as Matches, OrderBy, Promo, Template } from '../utils/promo'

const NONE = '__none'

type ApiError = { message: string; code?: string | undefined }

function Section({ title, description, children }: { title: string; description?: string | undefined; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Counter({ value, max }: { value: string | null; max: number }) {
  const n = value?.length ?? 0
  return <span className={cn('text-xs', n > max ? 'text-destructive' : 'text-muted-foreground')}>{n}/{max}</span>
}

function TemplateChooser({ onChoose }: { onChoose: (t: Template) => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/promos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Promo boxes
      </Link>
      <h1 className="text-xl font-semibold">What are you promoting?</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChoose(t.value)}
            className="rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary"
          >
            <div className="font-medium">{t.label}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t.hint}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PromoEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { accessToken, callAdmin } = useAuth()
  const signedIn = accessToken !== null

  const { trigger: triggerGet } = useGetPromo()
  const { trigger: triggerUpsert } = useUpsertPromo()
  const { trigger: triggerStatus } = useSetPromoStatus()
  const { trigger: triggerMatches } = usePreviewPromoMatches()
  const { trigger: triggerLookup } = useLookupCards()
  const { trigger: triggerRestore } = useRestorePromoRevision()
  const { trigger: triggerToken } = useIssuePreviewToken()

  const [promo, setPromo] = useState<Promo | null>(null)
  const [saved, setSaved] = useState<string>('')
  const [showCards, setShowCards] = useState(true)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'unpublish' | 'archive'>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [matches, setMatches] = useState<Matches | null>(null)
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [matchesError, setMatchesError] = useState<string | null>(null)
  const [refs, setRefs] = useState<Record<string, CardRef>>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isNew = !id

  // ── Load ──────────────────────────────────────────────────────────────────────────────────
  const load = useCallback(
    async (promoId: string) => {
      setLoading(true)
      setError(null)
      const res = (await callAdmin((token) => triggerGet({ accessToken: token, id: promoId }))) as FnResult | undefined
      setLoading(false)
      if (!res?.ok) {
        setError({ message: res?.message ?? 'Could not load the promo.', code: res?.code })
        return
      }
      const p = fromApi(res.data)
      setPromo(p)
      setSaved(JSON.stringify(toPayload(p, p.template === 'product_release' || hasCardCriteria(p))))
      setShowCards(p.template === 'product_release' || hasCardCriteria(p))
    },
    [callAdmin, triggerGet],
  )

  useEffect(() => {
    if (!signedIn) return
    if (id) void load(id)
    else {
      setPromo(null)
      setSaved('')
    }
  }, [id, signedIn, load])

  const payloadJson = promo ? JSON.stringify(toPayload(promo, showCards)) : ''
  const dirty = promo !== null && payloadJson !== saved

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // ── Field helpers ─────────────────────────────────────────────────────────────────────────
  const set = <K extends keyof Promo>(key: K, value: Promo[K]) => {
    setPromo((p) => (p ? { ...p, [key]: value } : p))
    setNotice(null)
  }
  const setFilter = (patch: Partial<Filter>) => {
    setPromo((p) => (p ? { ...p, filter: { ...p.filter, ...patch } } : p))
    setNotice(null)
  }
  const addRefs = (cards: CardRef[]) =>
    setRefs((r) => {
      const next = { ...r }
      for (const c of cards) next[c.ref_id] = c
      return next
    })

  // ── Live match preview ────────────────────────────────────────────────────────────────────
  const criteria = useMemo(
    () =>
      promo && showCards
        ? JSON.stringify({
            filter: cleanFilter(promo.filter),
            orderBy: promo.order_by,
            pinned: promo.pinned_ref_ids,
            excluded: promo.excluded_ref_ids,
          })
        : '',
    [promo, showCards],
  )
  const debouncedCriteria = useDebounced(criteria, 400)

  useEffect(() => {
    if (!debouncedCriteria) {
      setMatches(null)
      setMatchesError(null)
      return
    }
    const c = JSON.parse(debouncedCriteria) as { filter: Filter; orderBy: OrderBy; pinned: string[]; excluded: string[] }
    if (Object.keys(c.filter).length === 0 && c.pinned.length === 0) {
      setMatches(null)
      setMatchesError(null)
      return
    }
    let cancelled = false
    setMatchesLoading(true)
    void callAdmin((token) =>
      triggerMatches({ accessToken: token, filter: c.filter, orderBy: c.orderBy, pinned: c.pinned, excluded: c.excluded, limit: 18 }),
    ).then((res) => {
      if (cancelled) return
      setMatchesLoading(false)
      const r = res as FnResult | undefined
      if (!r?.ok) {
        setMatchesError(r?.message ?? 'Could not preview matches.')
        return
      }
      setMatchesError(null)
      const m = r.data as Matches
      setMatches(m)
      addRefs(m.sample.map((s) => ({ ref_id: s.ref_id, name: s.name, set_name: s.set_name, image_path: s.image_path, image_source_url: s.image_source_url })))
    })
    return () => {
      cancelled = true
    }
  }, [debouncedCriteria, callAdmin, triggerMatches])

  // Names for pinned/excluded cards that aren't in the sample.
  const missingRefs = useMemo(
    () => (promo ? [...promo.pinned_ref_ids, ...promo.excluded_ref_ids].filter((rid) => !refs[rid]) : []),
    [promo, refs],
  )
  useEffect(() => {
    if (missingRefs.length === 0) return
    void callAdmin((token) => triggerLookup({ accessToken: token, refIds: missingRefs })).then((res) => {
      const r = res as FnResult | undefined
      if (r?.ok && Array.isArray(r.data)) addRefs(r.data as CardRef[])
    })
  }, [missingRefs.join(','), callAdmin, triggerLookup]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────────────────────
  const save = async (): Promise<Promo | null> => {
    if (!promo) return null
    setError(null)
    setNotice(null)
    const res = (await callAdmin((token) => triggerUpsert({ accessToken: token, payload: toPayload(promo, showCards) }))) as
      | FnResult
      | undefined
    if (!res?.ok) {
      setError({ message: res?.message ?? 'Save failed.', code: res?.code })
      return null
    }
    const result = fromApi(res.data)
    if (isNew && result.id) {
      setSaved(JSON.stringify(toPayload(result, showCards)))
      navigate(`/promos/${result.id}`, { replace: true })
    } else if (result.id) {
      await load(result.id)
    }
    return result
  }

  const run = async (kind: 'save' | 'publish' | 'unpublish' | 'archive') => {
    if (!promo) return
    setBusy(kind)
    try {
      if (kind === 'save') {
        if (await save()) setNotice('Saved.')
        return
      }
      let target = promo
      if (dirty || !promo.id) {
        const result = await save()
        if (!result) return
        target = result
      }
      const status = kind === 'publish' ? 'published' : kind === 'unpublish' ? 'draft' : 'archived'
      const res = (await callAdmin((token) => triggerStatus({ accessToken: token, id: target.id as string, status }))) as
        | FnResult
        | undefined
      if (!res?.ok) {
        setError({ message: res?.message ?? 'Status change failed.', code: res?.code })
        return
      }
      if (target.id) await load(target.id)
      setNotice(
        kind === 'publish'
          ? publishLabel(target) === 'Schedule'
            ? `Scheduled for ${formatDateTime(target.starts_at)}.`
            : 'Published. It appears in the app within a few minutes.'
          : kind === 'unpublish'
            ? 'Unpublished. It is a draft again.'
            : 'Archived.',
      )
    } finally {
      setBusy(null)
    }
  }

  const restore = async (revisionId: number) => {
    const res = (await callAdmin((token) => triggerRestore({ accessToken: token, revisionId }))) as FnResult | undefined
    if (!res?.ok) {
      setError({ message: res?.message ?? 'Restore failed.', code: res?.code })
      return
    }
    if (promo?.id) await load(promo.id)
    setNotice('Version restored.')
  }

  const openPreview = async () => {
    if (!promo?.id || !APP_PREVIEW_BASE_URL) return
    const res = (await callAdmin((token) => triggerToken({ accessToken: token, promoId: promo.id as string }))) as
      | FnResult
      | undefined
    if (!res?.ok) {
      setError({ message: res?.message ?? 'Could not create a preview link.', code: res?.code })
      return
    }
    const token = (res.data as { token: string }).token
    setPreviewUrl(`${APP_PREVIEW_BASE_URL.replace(/\/$/, '')}/preview/promo/${promo.id}?token=${token}`)
  }

  const back = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    navigate('/promos')
  }

  // ── Render ────────────────────────────────────────────────────────────────────────────────
  if (isNew && !promo) {
    return <TemplateChooser onChoose={(t) => { setPromo(newPromo(t)); setShowCards(t === 'product_release'); setSaved('') }} />
  }
  if (!promo) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        {loading ? <Spinner className="w-6 h-6" /> : error ? (
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    )
  }

  const isRelease = promo.template === 'product_release'
  const status = promo.status ?? 'draft'
  const ctaKind: CtaKind | typeof NONE = promo.cta?.kind ?? NONE

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Promo boxes
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-xl font-semibold">{promo.title || (isNew ? 'New promo' : 'Untitled')}</h1>
          {promo.phase ? <PhaseChip phase={promo.phase} /> : null}
          {dirty ? <span className="text-xs text-amber-700 dark:text-amber-400">Unsaved changes</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === 'published' ? (
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run('unpublish')}>
              {busy === 'unpublish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
              Unpublish
            </Button>
          ) : null}
          {promo.id && status !== 'archived' ? (
            <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void run('archive')}>
              {busy === 'archive' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Archive
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={busy !== null || (!dirty && !isNew)} onClick={() => void run('save')}>
            {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {status === 'published' ? 'Save changes' : 'Save draft'}
          </Button>
          {status !== 'published' ? (
            <Button size="sm" disabled={busy !== null} onClick={() => void run('publish')}>
              {busy === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {status === 'archived' ? 'Restore & publish' : publishLabel(promo)}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{error.message}</span>
            {error.code === '40001' && promo.id ? (
              <Button variant="outline" size="sm" onClick={() => void load(promo.id as string)}>
                <RotateCcw className="w-4 h-4" /> Reload latest
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Check className="w-4 h-4" /> {notice}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Form ── */}
        <div className="space-y-4">
          <Section title="Template">
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    set('template', t.value)
                    if (t.value === 'product_release') setShowCards(true)
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    promo.template === t.value
                      ? 'border-transparent bg-primary/15 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{TEMPLATES.find((t) => t.value === promo.template)?.hint}</p>
          </Section>

          <Section title="Words" description="What people read on the card.">
            <Field label="Title" htmlFor="title">
              <div className="flex items-center gap-2">
                <Input id="title" value={promo.title} maxLength={80} placeholder={isRelease ? '2027 Topps Series 1' : 'Card show this weekend'} onChange={(e) => set('title', e.target.value)} />
                <Counter value={promo.title} max={80} />
              </div>
            </Field>
            <Field label="Subtitle (optional)" htmlFor="subtitle">
              <div className="flex items-center gap-2">
                <Input id="subtitle" value={promo.subtitle ?? ''} maxLength={120} onChange={(e) => set('subtitle', e.target.value)} />
                <Counter value={promo.subtitle} max={120} />
              </div>
            </Field>
            <Field label="Body (optional)" htmlFor="body" hint="Shown on the large hero card only.">
              <Textarea id="body" rows={3} value={promo.body ?? ''} maxLength={500} onChange={(e) => set('body', e.target.value)} />
              <div className="text-right"><Counter value={promo.body} max={500} /></div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Badge">
                <Select value={promo.badge ?? NONE} onValueChange={(v) => set('badge', v === NONE ? null : (v as Badge))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {BADGES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Accent colour" hint="Matches the app's light and dark themes.">
                <div className="flex flex-wrap gap-1.5">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      title={a.label}
                      aria-label={a.label}
                      aria-pressed={promo.accent === a.value}
                      onClick={() => set('accent', a.value)}
                      className={cn('h-7 w-7 rounded-full border-2', promo.accent === a.value ? 'border-foreground' : 'border-transparent')}
                      style={{ background: a.swatch }}
                    />
                  ))}
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Hero image">
            <HeroUpload promoId={promo.id} path={promo.hero_image_path} onChange={(p) => set('hero_image_path', p)} />
          </Section>

          <Section
            title="Cards"
            description={isRelease ? 'Which listings this release covers. Pin favourites to the front or hide ones that don’t fit.' : undefined}
          >
            {!isRelease ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showCards} onChange={(e) => setShowCards(e.target.checked)} />
                Show cards with this announcement
              </label>
            ) : null}

            {showCards ? (
              <>
                <Field label={isRelease ? 'Sets' : 'Sets (optional)'} htmlFor="sets" hint="Cards from any of these sets match.">
                  <SetPicker id="sets" value={promo.filter.sets ?? []} onChange={(sets) => setFilter({ sets })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Name contains" htmlFor="name_query" hint="Every word must appear, e.g. a player.">
                    <Input id="name_query" value={promo.filter.name_query ?? ''} onChange={(e) => setFilter({ name_query: e.target.value })} />
                  </Field>
                  <Field label="Card year" htmlFor="year" hint="Optional.">
                    <Input
                      id="year"
                      type="number"
                      min={1900}
                      max={2100}
                      value={promo.filter.release_year_min ?? ''}
                      onChange={(e) => {
                        const y = e.target.value ? Number(e.target.value) : undefined
                        setFilter({ release_year_min: y, release_year_max: y })
                      }}
                    />
                  </Field>
                  <Field label="Order">
                    <Select value={promo.order_by} onValueChange={(v) => set('order_by', v as OrderBy)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORDER_BY.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Product">
                    <Select
                      value={promo.filter.sealed === undefined ? NONE : promo.filter.sealed ? 'sealed' : 'singles'}
                      onValueChange={(v) => setFilter({ sealed: v === NONE ? undefined : v === 'sealed' })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Singles and sealed</SelectItem>
                        <SelectItem value="singles">Singles only</SelectItem>
                        <SelectItem value="sealed">Sealed only</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Grading">
                    <Select
                      value={promo.filter.graded === undefined ? NONE : promo.filter.graded ? 'graded' : 'raw'}
                      onValueChange={(v) => setFilter({ graded: v === NONE ? undefined : v === 'graded' })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Graded and raw</SelectItem>
                        <SelectItem value="graded">Graded only</SelectItem>
                        <SelectItem value="raw">Raw only</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Cards needed to go live" htmlFor="min_cards" hint="Until then it shows “Coming soon”.">
                    <Input
                      id="min_cards"
                      type="number"
                      min={0}
                      max={50}
                      value={promo.min_cards}
                      onChange={(e) => set('min_cards', Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                    />
                  </Field>
                </div>

                <MatchPreview
                  matches={matches}
                  loading={matchesLoading}
                  error={matchesError}
                  minCards={promo.min_cards}
                  pinned={promo.pinned_ref_ids}
                  excluded={promo.excluded_ref_ids}
                  refs={refs}
                  onPin={(rid) => set('pinned_ref_ids', [...promo.pinned_ref_ids.filter((x) => x !== rid), rid])}
                  onUnpin={(rid) => set('pinned_ref_ids', promo.pinned_ref_ids.filter((x) => x !== rid))}
                  onExclude={(rid) => {
                    setPromo((p) =>
                      p
                        ? {
                            ...p,
                            pinned_ref_ids: p.pinned_ref_ids.filter((x) => x !== rid),
                            excluded_ref_ids: [...p.excluded_ref_ids.filter((x) => x !== rid), rid],
                          }
                        : p,
                    )
                  }}
                  onRestore={(rid) => set('excluded_ref_ids', promo.excluded_ref_ids.filter((x) => x !== rid))}
                />
                <CardSearch
                  setName={promo.filter.sets?.[0] ?? null}
                  pinned={promo.pinned_ref_ids}
                  onPin={(card) => {
                    addRefs([card])
                    setPromo((p) =>
                      p
                        ? {
                            ...p,
                            pinned_ref_ids: [...p.pinned_ref_ids.filter((x) => x !== card.ref_id), card.ref_id],
                            excluded_ref_ids: p.excluded_ref_ids.filter((x) => x !== card.ref_id),
                          }
                        : p,
                    )
                  }}
                />
              </>
            ) : null}
          </Section>

          <Section title="Button" description="Optional call to action on the card.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Action">
                <Select
                  value={ctaKind}
                  onValueChange={(v) =>
                    set('cta', v === NONE ? null : { label: promo.cta?.label ?? (v === 'see_all' ? 'See all' : 'Learn more'), kind: v as CtaKind, target: promo.cta?.target })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No button</SelectItem>
                    {showCards ? <SelectItem value="see_all">See all cards</SelectItem> : null}
                    <SelectItem value="route">Open a screen in the app</SelectItem>
                    <SelectItem value="url">Open a website</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {promo.cta ? (
                <Field label="Label" htmlFor="cta_label">
                  <Input id="cta_label" maxLength={30} value={promo.cta.label} onChange={(e) => set('cta', { ...promo.cta!, label: e.target.value })} />
                </Field>
              ) : null}
              {promo.cta && promo.cta.kind !== 'see_all' ? (
                <Field
                  label={promo.cta.kind === 'url' ? 'Website (https://)' : 'App path'}
                  htmlFor="cta_target"
                  hint={promo.cta.kind === 'url' ? undefined : 'e.g. /marketplace'}
                >
                  <Input
                    id="cta_target"
                    value={promo.cta.target ?? ''}
                    placeholder={promo.cta.kind === 'url' ? 'https://' : '/'}
                    onChange={(e) => set('cta', { ...promo.cta!, target: e.target.value })}
                  />
                </Field>
              ) : null}
            </div>
          </Section>

          <Section title="Where and when">
            <Field label="Placement">
              <div className="grid gap-2 sm:grid-cols-2">
                {PLACEMENTS.map((pl) => (
                  <button
                    key={pl.value}
                    type="button"
                    onClick={() => set('placement', pl.value)}
                    className={cn(
                      'rounded-md border p-3 text-left transition-colors',
                      promo.placement === pl.value ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30',
                    )}
                  >
                    <div className="text-sm font-medium">{pl.label}</div>
                    <div className="text-xs text-muted-foreground">{pl.hint}</div>
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {isRelease ? (
                <Field label="Release date" htmlFor="release_date" hint="Shows a countdown until then.">
                  <Input id="release_date" type="datetime-local" value={toLocalInput(promo.release_date)} onChange={(e) => set('release_date', fromLocalInput(e.target.value))} />
                </Field>
              ) : null}
              <Field label="Priority" htmlFor="priority" hint="Higher shows first when several are live.">
                <Input id="priority" type="number" min={-1000} max={1000} value={promo.priority} onChange={(e) => set('priority', Number(e.target.value) || 0)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Show from (optional)" htmlFor="starts_at" hint="Leave empty to show as soon as it's published.">
                <Input id="starts_at" type="datetime-local" value={toLocalInput(promo.starts_at)} onChange={(e) => set('starts_at', fromLocalInput(e.target.value))} />
              </Field>
              <Field label="Show until (optional)" htmlFor="ends_at" hint="Leave empty to keep it up.">
                <Input id="ends_at" type="datetime-local" value={toLocalInput(promo.ends_at)} onChange={(e) => set('ends_at', fromLocalInput(e.target.value))} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">Times are in your time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
          </Section>

          {promo.id ? (
            <Section title="History" description={`Every save is kept. Last edited ${formatDateTime(promo.updated_at ?? null)}${promo.updated_by_email ? ` by ${promo.updated_by_email}` : ''}.`}>
              <RevisionHistory revisions={promo.revisions ?? []} current={promo.revision} dirty={dirty} onRestore={restore} />
            </Section>
          ) : null}
        </div>

        {/* ── Preview ── */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="text-sm font-medium">Preview</div>
          {previewUrl ? (
            <div className="mx-auto w-[300px] overflow-hidden rounded-[2.25rem] border-[10px] border-neutral-900 shadow-xl">
              <iframe title="App preview" src={previewUrl} className="h-[560px] w-full bg-background" />
            </div>
          ) : (
            <PhonePreview promo={promo} showCards={isRelease || (showCards && hasCardCriteria(promo))} matchCount={matches?.count ?? null} sample={matches?.sample ?? []} />
          )}
          {APP_PREVIEW_BASE_URL ? (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={!promo.id} onClick={() => void openPreview()}>
                {previewUrl ? 'Refresh app preview' : 'Preview in the app'}
              </Button>
              {previewUrl ? (
                <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(null)}>Mock-up</Button>
              ) : null}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              A mock-up of the Home feed. The real in-app preview comes with the app release of promo boxes.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

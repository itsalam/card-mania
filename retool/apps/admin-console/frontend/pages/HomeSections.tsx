/**
 * Home sections (ITS-110): the order, names, icons, on/off state and rail layout of the app's
 * Home feed sections (public.home_feed_section_meta).
 *
 * Layout follows two-column settings pages on Refero: a list of rows with right-aligned on/off
 * toggles (Jasper tools settings 4b045ef0-729f-4bb3-b335-2a0d0aecf910), icon + label rows with
 * an edit affordance (Kitchen.co aaa8ec62-50d2-4cfc-8548-c7aec4e3ee7c), and a form panel beside
 * the list (Linear preferences 068eb844-e9aa-4d77-8caa-fd08bec6d252).
 *
 * Order and on/off apply at once (optimistic, rolled back if the save fails); the edit panel
 * saves explicitly. Every change goes through admin.update_home_section /
 * admin.reorder_home_sections, which validate and audit it
 * (supabase/migrations/20261118000000_its110_home_sections_admin.sql).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useListHomeSections, useReorderHomeSections, useUpdateHomeSection } from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import type { FnResult } from '../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Heart,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../lib/shadcn/utils'

type Layout = {
  itemWidth?: number
  collapsedWidth?: number
  expandedHeight?: number
  collapsedHeight?: number
  expandable?: boolean
}

type Section = {
  key: string
  title: string
  icon: string
  enabled: boolean
  sort_order: number
  result_limit: number
  layout: Layout
  updated_at: string
}

/** Same names as HOME_FEED_SECTION_ICONS in the app (features/home/sectionIcons.ts). */
const ICONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'heart', label: 'Heart', Icon: Heart },
  { value: 'layers', label: 'Layers', Icon: Layers },
  { value: 'users', label: 'Users', Icon: Users },
  { value: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { value: 'trending_up', label: 'Trending', Icon: TrendingUp },
  { value: 'clock', label: 'Clock', Icon: Clock },
]

/** What each fixed key shows in the app; the key itself can't change here. */
const SECTION_HINTS: Record<string, string> = {
  promos: 'Promo boxes (no header in the app; title and icon are not shown)',
  wishlist_hits: 'Listings for sale that match the user’s wishlist',
  collections: 'The user’s collections',
  suggested_sellers: 'Sellers the user doesn’t follow yet',
}

/** Rail sizes, in points. Empty = the app's default for that section. */
const LAYOUT_FIELDS: { key: 'itemWidth' | 'collapsedWidth' | 'expandedHeight'; label: string; hint: string; min: number; max: number }[] = [
  { key: 'itemWidth', label: 'Item width', hint: 'Width of each item in the rail', min: 40, max: 400 },
  { key: 'collapsedWidth', label: 'Collapsed item width', hint: 'Item width while the section is collapsed, if different', min: 40, max: 400 },
  { key: 'expandedHeight', label: 'Expanded height', hint: 'Height of the section when opened', min: 60, max: 800 },
]

function iconFor(name: string): LucideIcon {
  return ICONS.find((i) => i.value === name)?.Icon ?? Sparkles
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!on)
      }}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50',
        on ? 'border-transparent bg-primary' : 'border-border bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-background shadow transition-transform',
          on ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

type Draft = {
  title: string
  icon: string
  result_limit: string
  layout: Record<'itemWidth' | 'collapsedWidth' | 'expandedHeight', string>
  expandable: 'default' | 'yes' | 'no'
}

function toDraft(s: Section): Draft {
  const l = s.layout ?? {}
  return {
    title: s.title,
    icon: s.icon,
    result_limit: String(s.result_limit),
    layout: {
      itemWidth: l.itemWidth != null ? String(l.itemWidth) : '',
      collapsedWidth: l.collapsedWidth != null ? String(l.collapsedWidth) : '',
      expandedHeight: l.expandedHeight != null ? String(l.expandedHeight) : '',
    },
    expandable: l.expandable == null ? 'default' : l.expandable ? 'yes' : 'no',
  }
}

/** Builds the patch from the draft, or an error message for the first invalid field. */
function toPatch(d: Draft, original: Section): { patch: Record<string, unknown> } | { error: string } {
  const title = d.title.trim()
  if (!title) return { error: 'Title is required.' }
  const limit = Number(d.result_limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return { error: 'Items shown must be a whole number from 1 to 50.' }

  // Keep layout keys this form doesn't edit (e.g. the legacy collapsedHeight).
  const layout: Layout = { ...(original.layout ?? {}) }
  for (const f of LAYOUT_FIELDS) {
    const raw = d.layout[f.key].trim()
    if (!raw) {
      delete layout[f.key]
      continue
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < f.min || n > f.max) return { error: `${f.label} must be a number from ${f.min} to ${f.max}.` }
    layout[f.key] = n
  }
  if (d.expandable === 'default') delete layout.expandable
  else layout.expandable = d.expandable === 'yes'

  return {
    patch: {
      title,
      icon: d.icon,
      result_limit: limit,
      layout,
      expected_updated_at: original.updated_at,
    },
  }
}

export default function HomeSections() {
  const { accessToken, callAdmin } = useAuth()
  const signedIn = accessToken !== null
  const { trigger: triggerList } = useListHomeSections()
  const { trigger: triggerUpdate } = useUpdateHomeSection()
  const { trigger: triggerReorder } = useReorderHomeSections()

  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    setError(null)
    const res = (await callAdmin((token) => triggerList({ accessToken: token }))) as FnResult | undefined
    setLoading(false)
    if (!res?.ok) {
      setError(res?.message ?? 'Could not load the Home sections.')
      return
    }
    const rows = Array.isArray(res.data) ? (res.data as Section[]) : []
    setSections(rows)
    setSelectedKey((current) => (current && rows.some((r) => r.key === current) ? current : (rows[0]?.key ?? null)))
  }, [signedIn, callAdmin, triggerList])

  useEffect(() => {
    void load()
  }, [load])

  const selected = sections.find((s) => s.key === selectedKey) ?? null

  // Reset the form when switching sections or after the selected row reloads or saves.
  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null)
    setSaveError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.key, selected?.updated_at])
  useEffect(() => {
    setSavedAt(null)
  }, [selected?.key])

  const dirty = useMemo(() => {
    if (!selected || !draft) return false
    return JSON.stringify(draft) !== JSON.stringify(toDraft(selected))
  }, [selected, draft])

  const replaceRow = (row: Section) => setSections((prev) => prev.map((s) => (s.key === row.key ? row : s)))

  // On/off: flips at once, rolls back if the save fails.
  const setEnabled = async (section: Section, enabled: boolean) => {
    replaceRow({ ...section, enabled })
    setError(null)
    const res = (await callAdmin((token) =>
      triggerUpdate({ accessToken: token, key: section.key, patch: { enabled } }),
    )) as FnResult | undefined
    if (!res?.ok) {
      replaceRow(section)
      setError(res?.message ?? `Could not turn ${section.title} ${enabled ? 'on' : 'off'}.`)
      return
    }
    replaceRow(res.data as Section)
  }

  // Reorder: moves at once, rolls back if the save fails.
  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= sections.length) return
    const previous = sections
    const next = [...sections]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    setSections(next)
    setError(null)
    const res = (await callAdmin((token) =>
      triggerReorder({ accessToken: token, keys: next.map((s) => s.key) }),
    )) as FnResult | undefined
    if (!res?.ok) {
      setSections(previous)
      setError(res?.message ?? 'Could not save the new order.')
      return
    }
    if (Array.isArray(res.data)) setSections(res.data as Section[])
  }

  const save = async () => {
    if (!selected || !draft) return
    const built = toPatch(draft, selected)
    if ('error' in built) {
      setSaveError(built.error)
      return
    }
    setSaving(true)
    setSaveError(null)
    const res = (await callAdmin((token) =>
      triggerUpdate({ accessToken: token, key: selected.key, patch: built.patch }),
    )) as FnResult | undefined
    setSaving(false)
    if (!res?.ok) {
      setSaveError(
        res?.code === '40001'
          ? 'Someone else changed this section since you opened it. Reload to see their version.'
          : (res?.message ?? 'Could not save.'),
      )
      return
    }
    replaceRow(res.data as Section)
    setSavedAt(Date.now())
  }

  const setLayoutField = (key: keyof Draft['layout'], value: string) =>
    setDraft((d) => (d ? { ...d, layout: { ...d.layout, [key]: value } } : d))

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Home sections</CardTitle>
          <CardDescription>
            The sections on the app’s Home feed, top to bottom. Changes reach the app within a minute.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Reload
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* ── Order and on/off ── */}
          <ol className="divide-y divide-border rounded-md border border-border" aria-label="Home sections in order">
            {sections.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                {loading ? 'Loading sections…' : 'No sections.'}
              </li>
            ) : (
              sections.map((s, i) => {
                const Icon = iconFor(s.icon)
                return (
                  <li
                    key={s.key}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3 py-2.5',
                      s.key === selectedKey ? 'bg-accent/60' : 'hover:bg-accent/30',
                    )}
                    onClick={() => setSelectedKey(s.key)}
                    aria-current={s.key === selectedKey}
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label={`Move ${s.title} up`}
                        disabled={i === 0}
                        onClick={(e) => {
                          e.stopPropagation()
                          void move(i, -1)
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${s.title} down`}
                        disabled={i === sections.length - 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          void move(i, 1)
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-sm font-medium', !s.enabled && 'text-muted-foreground line-through')}>
                        {s.title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{s.key}</div>
                    </div>
                    <Toggle on={s.enabled} label={`Show ${s.title}`} onChange={(next) => void setEnabled(s, next)} />
                  </li>
                )
              })
            )}
          </ol>

          {/* ── Edit the selected section ── */}
          {selected && draft ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <div>
                <div className="text-sm font-medium text-foreground">{selected.title}</div>
                <div className="text-xs text-muted-foreground">{SECTION_HINTS[selected.key] ?? selected.key}</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="section-title">Title</Label>
                <Input
                  id="section-title"
                  value={draft.title}
                  maxLength={40}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Icon">
                  {ICONS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={draft.icon === value}
                      title={label}
                      onClick={() => setDraft({ ...draft, icon: value })}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                        draft.icon === value
                          ? 'border-transparent bg-primary/15 text-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="section-limit">Items shown</Label>
                <Input
                  id="section-limit"
                  type="number"
                  min={1}
                  max={50}
                  className="w-28"
                  value={draft.result_limit}
                  onChange={(e) => setDraft({ ...draft, result_limit: e.target.value })}
                />
              </div>

              <fieldset className="space-y-3 rounded-md border border-border p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">Rail layout (points; empty = app default)</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {LAYOUT_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label htmlFor={`layout-${f.key}`} title={f.hint}>
                        {f.label}
                      </Label>
                      <Input
                        id={`layout-${f.key}`}
                        type="number"
                        min={f.min}
                        max={f.max}
                        placeholder="Default"
                        value={draft.layout[f.key]}
                        onChange={(e) => setLayoutField(f.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label>Can open into a full list</Label>
                  <div className="flex gap-1" role="radiogroup" aria-label="Can open into a full list">
                    {(
                      [
                        ['default', 'App default'],
                        ['yes', 'Yes'],
                        ['no', 'No'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={draft.expandable === value}
                        onClick={() => setDraft({ ...draft, expandable: value })}
                        className={cn(
                          'rounded-full border px-3 py-1 text-sm transition-colors',
                          draft.expandable === value
                            ? 'border-transparent bg-primary/15 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </fieldset>

              {saveError ? (
                <Alert variant="destructive">
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" disabled={!dirty || saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                {dirty ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(toDraft(selected))} disabled={saving}>
                    Discard changes
                  </Button>
                ) : savedAt ? (
                  <span className="text-sm text-muted-foreground">Saved</span>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

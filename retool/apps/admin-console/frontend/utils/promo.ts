import { SUPABASE_URL } from '../config'

export type Template = 'product_release' | 'announcement'
export type Badge = 'new' | 'coming_soon' | 'hot'
export type Accent = 'violet' | 'purple' | 'blue' | 'cyan' | 'green' | 'yellow' | 'orange' | 'red' | 'grey'
export type OrderBy = 'popularity' | 'value_desc' | 'value_asc' | 'newest'
export type Placement = 'home_hero' | 'home_rail'
export type Status = 'draft' | 'published' | 'archived'
export type Phase = 'draft' | 'scheduled' | 'live' | 'ended' | 'archived'
export type CtaKind = 'see_all' | 'route' | 'url'

export type Cta = { label: string; kind: CtaKind; target?: string }

/** The ITS-97 feed filter keys the editor exposes. */
export type Filter = {
  sets?: string[]
  name_query?: string
  sealed?: boolean
  graded?: boolean
  release_year_min?: number
  release_year_max?: number
}

export type Revision = { id: number; revision: number; created_at: string; created_by_email: string | null }

export type Promo = {
  id?: string
  revision?: number
  slug: string | null
  template: Template
  title: string
  subtitle: string | null
  body: string | null
  badge: Badge | null
  hero_image_path: string | null
  accent: Accent | null
  cta: Cta | null
  filter: Filter
  order_by: OrderBy
  pinned_ref_ids: string[]
  excluded_ref_ids: string[]
  min_cards: number
  placement: Placement
  priority: number
  release_date: string | null
  starts_at: string | null
  ends_at: string | null
  status?: Status
  phase?: Phase
  updated_at?: string
  updated_by_email?: string | null
  revisions?: Revision[]
}

export type PromoListRow = {
  id: string
  slug: string
  template: Template
  title: string
  placement: Placement
  priority: number
  status: Status
  phase: Phase
  release_date: string | null
  starts_at: string | null
  ends_at: string | null
  revision: number
  updated_at: string
  updated_by_email: string | null
}

export type MatchCard = {
  rank: number
  ref_id: string
  name: string
  set_name: string | null
  market_value: number | null
  grading_company: string | null
  seller_username: string | null
  pinned: boolean
  image_path: string | null
  image_source_url: string | null
}

export type MatchPreview = { count: number; count_capped: boolean; sample: MatchCard[] }

export type CardRef = {
  ref_id: string
  name: string
  set_name: string | null
  image_path: string | null
  image_source_url: string | null
}

export const TEMPLATES: { value: Template; label: string; hint: string }[] = [
  { value: 'product_release', label: 'Product release', hint: 'A new set or box, with a countdown until it lands' },
  { value: 'announcement', label: 'Announcement', hint: 'News, events or a link, with or without cards' },
]

export const BADGES: { value: Badge; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'coming_soon', label: 'Coming soon' },
  { value: 'hot', label: 'Hot' },
]

/** Approximate swatches for the picker; the app maps the key to its own theme colour. */
export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { value: 'purple', label: 'Purple', swatch: '#a855f7' },
  { value: 'blue', label: 'Blue', swatch: '#3b82f6' },
  { value: 'cyan', label: 'Cyan', swatch: '#06b6d4' },
  { value: 'green', label: 'Green', swatch: '#22c55e' },
  { value: 'yellow', label: 'Yellow', swatch: '#eab308' },
  { value: 'orange', label: 'Orange', swatch: '#f97316' },
  { value: 'red', label: 'Red', swatch: '#ef4444' },
  { value: 'grey', label: 'Grey', swatch: '#6b7280' },
]

export const ORDER_BY: { value: OrderBy; label: string }[] = [
  { value: 'popularity', label: 'Most popular' },
  { value: 'value_desc', label: 'Highest value' },
  { value: 'value_asc', label: 'Lowest value' },
  { value: 'newest', label: 'Newest listings' },
]

export const PLACEMENTS: { value: Placement; label: string; hint: string }[] = [
  { value: 'home_hero', label: 'Home hero', hint: 'Large banner at the top of Home' },
  { value: 'home_rail', label: 'Home rail', hint: 'A card row in the Home feed' },
]

export const PHASES: { value: Phase; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'ended', label: 'Ended' },
  { value: 'archived', label: 'Archived' },
]

export const PHASE_CLASS: Record<Phase, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  live: 'bg-green-500/15 text-green-700 dark:text-green-400',
  ended: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  archived: 'bg-muted text-muted-foreground line-through',
}

export function newPromo(template: Template): Promo {
  return {
    slug: null,
    template,
    title: '',
    subtitle: null,
    body: null,
    badge: template === 'product_release' ? 'coming_soon' : null,
    hero_image_path: null,
    accent: 'blue',
    cta: template === 'product_release' ? { label: 'See all', kind: 'see_all' } : null,
    filter: {},
    order_by: 'popularity',
    pinned_ref_ids: [],
    excluded_ref_ids: [],
    min_cards: 4,
    placement: template === 'product_release' ? 'home_hero' : 'home_rail',
    priority: 0,
    release_date: null,
    starts_at: null,
    ends_at: null,
  }
}

/** Normalizes a promo from the API into editor state. */
export function fromApi(raw: unknown): Promo {
  const p = (raw ?? {}) as Partial<Promo> & Record<string, unknown>
  return {
    ...newPromo((p.template as Template) ?? 'announcement'),
    ...p,
    filter: (p.filter as Filter) ?? {},
    pinned_ref_ids: (p.pinned_ref_ids as string[]) ?? [],
    excluded_ref_ids: (p.excluded_ref_ids as string[]) ?? [],
    revisions: (p.revisions as Revision[]) ?? [],
  } as Promo
}

/** Drops empty filter values so the saved filter only holds real criteria. */
export function cleanFilter(filter: Filter): Filter {
  const out: Filter = {}
  if (filter.sets && filter.sets.length > 0) out.sets = filter.sets
  if (filter.name_query && filter.name_query.trim()) out.name_query = filter.name_query.trim()
  if (typeof filter.sealed === 'boolean') out.sealed = filter.sealed
  if (typeof filter.graded === 'boolean') out.graded = filter.graded
  if (Number.isInteger(filter.release_year_min)) out.release_year_min = filter.release_year_min
  if (Number.isInteger(filter.release_year_max)) out.release_year_max = filter.release_year_max
  return out
}

const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

/** The payload upsert_promo expects: editable fields only, plus id/revision for updates. */
export function toPayload(p: Promo, showCards: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    template: p.template,
    title: p.title.trim(),
    subtitle: blankToNull(p.subtitle),
    body: blankToNull(p.body),
    badge: p.badge,
    hero_image_path: p.hero_image_path,
    accent: p.accent,
    cta: p.cta ? { label: p.cta.label.trim(), kind: p.cta.kind, ...(p.cta.kind === 'see_all' ? {} : { target: (p.cta.target ?? '').trim() }) } : null,
    filter: showCards ? cleanFilter(p.filter) : {},
    order_by: p.order_by,
    pinned_ref_ids: showCards ? p.pinned_ref_ids : [],
    excluded_ref_ids: showCards ? p.excluded_ref_ids : [],
    min_cards: p.min_cards,
    placement: p.placement,
    priority: p.priority,
    release_date: p.release_date,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
  }
  if (p.slug && p.slug.trim()) payload.slug = p.slug.trim()
  if (p.id) {
    payload.id = p.id
    payload.revision = p.revision
  }
  return payload
}

export function hasCardCriteria(p: Promo): boolean {
  return Object.keys(cleanFilter(p.filter)).length > 0 || p.pinned_ref_ids.length > 0
}

/** Public URL of a card image (images bucket) or its source URL while it's being fetched. */
export function cardImageUrl(c: { image_path: string | null; image_source_url: string | null }): string | null {
  if (c.image_path) return `${SUPABASE_URL}/storage/v1/object/public/images/${encodePath(c.image_path)}`
  return c.image_source_url
}

export function promoAssetUrl(path: string | null): string | null {
  return path ? `${SUPABASE_URL}/storage/v1/object/public/promo-assets/${encodePath(path)}` : null
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

/** ISO timestamp → value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value → ISO timestamp (null when empty). */
export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatCents(cents: number | null): string {
  if (cents == null || cents <= 0) return ''
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

/** "3d 4h", "5h 12m", "12m" until the given time; null once it has passed. */
export function countdown(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now
  if (!(ms > 0)) return null
  const mins = Math.floor(ms / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(m, 1)}m`
}

/** The mode the app will render, mirroring admin._promo_mode. */
export function previewMode(p: Promo, showCards: boolean, matchCount: number | null): 'announcement' | 'coming_soon' | 'cards' {
  if (!showCards) return 'announcement'
  const released = !p.release_date || new Date(p.release_date).getTime() <= Date.now()
  return released && (matchCount ?? 0) >= p.min_cards ? 'cards' : 'coming_soon'
}

/** What a publish button should say for the current schedule. */
export function publishLabel(p: Promo): 'Publish' | 'Schedule' {
  return p.starts_at && new Date(p.starts_at).getTime() > Date.now() ? 'Schedule' : 'Publish'
}

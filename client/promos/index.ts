import type { FeaturedListing } from '@/client/marketplace'
import { getSupabase } from '@/lib/store/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL

export type PromoMode = 'announcement' | 'coming_soon' | 'cards'
export type PromoPlacement = 'home_hero' | 'home_rail'
export type PromoAccent =
  'violet' | 'purple' | 'blue' | 'cyan' | 'green' | 'yellow' | 'orange' | 'red' | 'grey'
export type PromoCta = { label: string; kind: 'see_all' | 'route' | 'url'; target?: string }

/** One row of get_active_promos / get_promo_preview (20261114000000_its191_promo_boxes.sql). */
export type Promo = {
  id: string
  slug: string
  template: 'product_release' | 'announcement'
  placement: PromoPlacement
  priority: number
  title: string
  subtitle: string | null
  body: string | null
  badge: 'new' | 'coming_soon' | 'hot' | null
  hero_image_path: string | null
  accent: PromoAccent | null
  cta: PromoCta | null
  release_date: string | null
  ends_at: string | null
  /** The hidden marketplace section that holds the cards; null for a promo without cards. */
  section_key: string | null
  /** What to render: decided server-side from the release date and how many cards matched. */
  mode: PromoMode
  item_count: number
  /** Listings in display order (pinned first); empty unless mode is 'cards'. */
  items: FeaturedListing[]
}

export type PromoPreview = Promo & { status: string; phase: string }

/** Public URL of a hero image in the promo-assets bucket. */
export function promoAssetUrl(path: string | null): string | null {
  if (!path || !supabaseUrl) return null
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${supabaseUrl}/storage/v1/object/public/promo-assets/${encoded}`
}

const promosKey = (placement?: PromoPlacement) =>
  [supabaseUrl, 'promos', 'active', placement ?? 'all'] as const

/** Live promos, highest priority first. `placement` narrows to one slot. */
export function useActivePromos(placement?: PromoPlacement) {
  return useQuery<Promo[]>({
    queryKey: promosKey(placement),
    queryFn: async () => {
      const { data, error } = await (getSupabase() as any).rpc('get_active_promos', {
        p_placement: placement ?? null,
      })
      if (error) throw error
      return (data ?? []) as Promo[]
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    // A coming-soon box flips to cards on its own once the release passes.
    refetchInterval: 5 * 60_000,
  })
}

/** One live promo (the "See all" screen), from the shared active-promos cache. */
export function useActivePromo(id: string | undefined) {
  const query = useActivePromos()
  return { ...query, data: query.data?.find((p) => p.id === id || p.slug === id) }
}

/** A draft or scheduled promo, via a preview token from the admin console. Null when the token
 *  is missing, wrong or expired. */
export function usePromoPreview(token: string | undefined) {
  return useQuery<PromoPreview | null>({
    queryKey: [supabaseUrl, 'promos', 'preview', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data, error } = await (getSupabase() as any).rpc('get_promo_preview', {
        p_token: token,
      })
      if (error) throw error
      return ((data ?? [])[0] ?? null) as PromoPreview | null
    },
    staleTime: 0,
    retry: false,
  })
}

// ── Tracking ────────────────────────────────────────────────────────────────────────────────────

/** Random per app launch; only used to count each promo once per session. */
const SESSION_ID = Array.from({ length: 24 }, () =>
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(
    Math.floor(Math.random() * 62)
  )
).join('')

const sent = new Set<string>()

/** Fire-and-forget. Deduplicated here and again server-side, so calling it on every render or
 *  tap is fine; a failure never surfaces to the user. */
export function recordPromoEvent(
  promoId: string,
  kind: 'impression' | 'tap',
  placement?: PromoPlacement
) {
  const key = `${promoId}:${kind}`
  if (sent.has(key)) return
  sent.add(key)
  ;(getSupabase() as any)
    .rpc('record_promo_event', {
      p_promo_id: promoId,
      p_kind: kind,
      p_session_id: SESSION_ID,
      p_placement: placement ?? null,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) sent.delete(key)
    })
}

/** Records one impression per promo per session once the box is on screen. */
export function usePromoImpression(promo: Promo | undefined, enabled = true) {
  useEffect(() => {
    if (enabled && promo) recordPromoEvent(promo.id, 'impression', promo.placement)
  }, [enabled, promo])
}

// ── Notify me ───────────────────────────────────────────────────────────────────────────────────

const interestsKey = [supabaseUrl, 'promos', 'interests'] as const

export function usePromoInterests(enabled = true) {
  return useQuery<Set<string>>({
    queryKey: interestsKey,
    enabled,
    queryFn: async () => {
      const { data, error } = await (getSupabase() as any).rpc('get_my_promo_interests')
      if (error) throw error
      return new Set(((data ?? []) as string[]).map(String))
    },
    staleTime: 5 * 60_000,
  })
}

/** Toggles "Notify me" optimistically (CLAUDE.md toggle pattern): the set flips in onMutate,
 *  rolls back in onError and is reconciled with the server afterwards. */
export function useTogglePromoInterest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ promoId, on }: { promoId: string; on: boolean }) => {
      const { error } = await (getSupabase() as any).rpc('set_promo_interest', {
        p_promo_id: promoId,
        p_on: on,
      })
      if (error) throw error
    },
    onMutate: async ({ promoId, on }) => {
      await qc.cancelQueries({ queryKey: interestsKey })
      const previous = qc.getQueryData<Set<string>>(interestsKey)
      const next = new Set(previous ?? [])
      if (on) next.add(promoId)
      else next.delete(promoId)
      qc.setQueryData(interestsKey, next)
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(interestsKey, ctx?.previous ?? new Set())
    },
    onSettled: () => qc.invalidateQueries({ queryKey: interestsKey }),
  })
}

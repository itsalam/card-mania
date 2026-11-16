/**
 * ProductBox: a promo box from the admin console (ITS-191/192/193), rendered on Home and in the
 * admin preview route.
 *
 * Two variants, picked by the promo's placement:
 *  - hero (home_hero): full-width art on top, then badge, title, subtitle and the mode's content
 *  - rail (home_rail): compact row with a square thumbnail, for a box further down the feed
 *
 * Three modes, decided server-side (admin._promo_mode):
 *  - coming_soon: release countdown + "Notify me"
 *  - cards: a rail of the matching listings + the button (usually "See all")
 *  - announcement: copy + the button
 *
 * Design references (ITS-192):
 *  - Hero art, title and CTA pill: X "Top 100 Players of 2026"
 *    https://mobbin.com/screens/1a944d6b-a5d6-4598-bbcd-c15606bc2c99
 *  - Badge treatment: Sweatcoin promo cards
 *    https://mobbin.com/screens/4a6888b9-77e5-4537-9813-c777998eae27
 *
 * Colours: the accent is a theme token (`$accent<Hue>`, components/ui/theme), so light/dark both
 * work; the card follows CLAUDE.md "Accent borders vs. visibility borders".
 */
import {
  type Promo,
  promoAssetUrl,
  recordPromoEvent,
  usePromoInterests,
  useTogglePromoInterest,
} from '@/client/promos'
import { Text } from '@/components/ui/text/base-text'
import { FeaturedCard } from '@/features/marketplace/FeaturedCard'
import { useUserStore } from '@/lib/store/useUserStore'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Bell, BellRing, ChevronRight } from 'lucide-react-native'
import React from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { accentColor } from './accent'
import { useCountdown } from './useCountdown'

const BADGE_LABEL: Record<NonNullable<Promo['badge']>, string> = {
  new: 'New',
  coming_soon: 'Coming soon',
  hot: 'Hot',
}

/** Cards shown in the box itself; "See all" shows the rest. */
const BOX_CARD_LIMIT = 10
const BOX_CARD_WIDTH = 96

type Props = {
  promo: Promo
  /** Preview route: no tracking, no navigation, Notify me is inert. */
  preview?: boolean
  variant?: 'hero' | 'rail'
}

export function ProductBox({ promo, preview = false, variant }: Props) {
  const router = useRouter()
  const kind = variant ?? (promo.placement === 'home_hero' ? 'hero' : 'rail')
  const accent = accentColor(promo.accent)
  const heroUrl = promoAssetUrl(promo.hero_image_path)
  const countdown = useCountdown(promo.mode === 'coming_soon' ? promo.release_date : null)

  const openCta = () => {
    if (preview || !promo.cta) return
    recordPromoEvent(promo.id, 'tap', promo.placement)
    const { kind: ctaKind, target } = promo.cta
    if (ctaKind === 'see_all') router.push(`/promo/${promo.id}`)
    else if (ctaKind === 'route' && target) router.push(target as never)
    else if (ctaKind === 'url' && target) Linking.openURL(target).catch(() => {})
  }

  // A coming-soon "See all" has nothing to show yet, so the button waits for the cards.
  const showCta =
    Boolean(promo.cta) && !(promo.mode === 'coming_soon' && promo.cta?.kind === 'see_all')
  const items = promo.items.slice(0, BOX_CARD_LIMIT)

  return (
    <Pressable
      onPress={showCta ? openCta : undefined}
      accessibilityRole={showCta ? 'button' : undefined}
      accessibilityLabel={promo.title}
      style={[
        styles.card,
        {
          backgroundColor: Colors.$backgroundElevated,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
          borderLeftColor: accent,
        },
      ]}
    >
      {kind === 'hero' && heroUrl ? (
        <Image
          source={{ uri: heroUrl }}
          style={[styles.heroImage, { backgroundColor: Colors.$backgroundNeutral }]}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.headerRow}>
          {kind === 'rail' && heroUrl ? (
            <Image
              source={{ uri: heroUrl }}
              style={[styles.thumb, { backgroundColor: Colors.$backgroundNeutral }]}
              contentFit="cover"
            />
          ) : null}
          <View style={{ flex: 1, gap: 6 }}>
            {promo.badge ? <Badge label={BADGE_LABEL[promo.badge]} color={accent} /> : null}
            <Text variant={kind === 'hero' ? 'h4' : 'large'} numberOfLines={2}>
              {promo.title}
            </Text>
            {promo.subtitle ? (
              <Text style={[styles.subtitle, { color: Colors.$textNeutral }]} numberOfLines={2}>
                {promo.subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {promo.body && promo.mode !== 'cards' ? (
          <Text
            style={[styles.bodyText, { color: Colors.$textNeutral }]}
            numberOfLines={kind === 'hero' ? 4 : 2}
          >
            {promo.body}
          </Text>
        ) : null}

        {promo.mode === 'coming_soon' ? (
          <View style={styles.comingSoonRow}>
            <Text variant="stats-header" style={{ color: accent }}>
              {countdown ? `Drops in ${countdown}` : 'Dropping soon'}
            </Text>
            <NotifyMe promoId={promo.id} accent={accent} disabled={preview} />
          </View>
        ) : null}

        {promo.mode === 'cards' && items.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            // The cards open their own listing; the box's own press is the CTA.
            pointerEvents={preview ? 'none' : 'auto'}
          >
            {items.map((item) => (
              <FeaturedCard
                key={item.collection_item_id}
                item={{ ...item, id: item.collection_item_id }}
                width={BOX_CARD_WIDTH}
              />
            ))}
          </ScrollView>
        ) : null}

        {showCta && promo.cta ? (
          <View style={styles.ctaRow}>
            <View style={[styles.ctaPill, { backgroundColor: Colors.rgba(accent, 0.18) }]}>
              <Text variant="small" style={{ color: Colors.$textDefault }}>
                {promo.cta.kind === 'see_all' && promo.item_count > 0
                  ? `${promo.cta.label} · ${promo.item_count}`
                  : promo.cta.label}
              </Text>
              <ChevronRight size={14} color={Colors.$iconDefault} />
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: Colors.rgba(color, 0.18) }]}>
      <Text variant="stats" style={{ color }}>
        {label.toUpperCase()}
      </Text>
    </View>
  )
}

/** Toggle-style (CLAUDE.md): flips on press via the mutation's onMutate, rolls back on error. */
function NotifyMe({
  promoId,
  accent,
  disabled,
}: {
  promoId: string
  accent: string
  disabled: boolean
}) {
  const signedIn = Boolean(useUserStore((s) => s.user?.id))
  const { data: interests } = usePromoInterests(signedIn && !disabled)
  const { mutate } = useTogglePromoInterest()
  const on = interests?.has(promoId) ?? false
  if (!signedIn && !disabled) return null

  const Icon = on ? BellRing : Bell
  return (
    <Pressable
      hitSlop={6}
      disabled={disabled}
      onPress={(e) => {
        e.stopPropagation()
        mutate({ promoId, on: !on })
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Notify me when it drops"
      style={[
        styles.notify,
        on
          ? { backgroundColor: Colors.rgba(accent, 0.25), borderColor: 'transparent' }
          : {
              backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
              borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
            },
      ]}
    >
      <Icon size={13} color={on ? accent : Colors.$iconDefault} />
      <Text variant="stats" style={{ color: Colors.$textDefault }}>
        {on ? "We'll notify you" : 'Notify me'}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  body: { padding: 14, gap: 10 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  subtitle: { fontSize: 14, lineHeight: 19 },
  bodyText: { fontSize: 14, lineHeight: 20 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  comingSoonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  notify: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  ctaRow: { flexDirection: 'row' },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
})

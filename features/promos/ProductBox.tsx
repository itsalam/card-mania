/**
 * ProductBox: a promo box from the admin console (ITS-191/192/193), rendered on Home and in the
 * admin preview route.
 *
 * Two variants, picked by the promo's placement:
 *  - hero (home_hero): full-width art with the badge on it, then title, subtitle, the mode's
 *    content and a full-width button
 *  - rail (home_rail): compact row with a square thumbnail and an inline "See all ›" link, for a
 *    box further down the feed
 *
 * Three modes, decided server-side (admin._promo_mode):
 *  - coming_soon: release countdown (days / hrs / min) + "Notify me"
 *  - cards: a rail of the matching listings + the button (usually "See all")
 *  - announcement: copy + the button
 *
 * The accent tints the whole surface, the eyebrow label and the button, instead of a coloured
 * left border: a stripe down one edge read as highlighting the text beside it, not as the
 * promo's colour. Design references (ITS-192, redesign):
 *  - Tinted promo surface, accent eyebrow above the title, full-width button: Headway shop card
 *    https://mobbin.com/screens/3a541ee7-0345-45e6-96f1-5631274b7223
 *  - Badge as a pill on the art: Blinkit "Brand of the day"
 *    https://mobbin.com/screens/e9a3616d-56ac-4347-bfaf-51bc62d29089
 *  - Countdown as separate day / hour / minute boxes: Swiggy flash sale, DoorDash trivia
 *    https://mobbin.com/screens/b50167a6-96ba-4ea8-8a3e-bb9b5d6267a5
 *    https://mobbin.com/screens/d078a30c-209b-46a5-921b-d1d3eed1c75c
 *  - Compact box with "See all ›" beside the title: Apple Books "Audiobooks We Love"
 *    https://mobbin.com/screens/35727270-ae7f-4cf5-8de3-a37fdf631c28
 *  - Original hero art + CTA pill: X "Top 100 Players of 2026"
 *    https://mobbin.com/screens/1a944d6b-a5d6-4598-bbcd-c15606bc2c99
 *
 * Colours: the accent is a theme token (`$accent<Hue>`, components/ui/theme), so light/dark both
 * work; every colour is read at render time (inline), never in the module-level StyleSheet.
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
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Bell, BellRing, ChevronRight, Clock } from 'lucide-react-native'
import React from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { accentColor } from './accent'
import { type CountdownParts, useCountdown, useCountdownParts } from './useCountdown'

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
  const releaseIso = promo.mode === 'coming_soon' ? promo.release_date : null

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
  const ctaLabel =
    promo.cta?.kind === 'see_all' && promo.item_count > 0
      ? `${promo.cta.label} · ${promo.item_count}`
      : (promo.cta?.label ?? '')
  const items = promo.items.slice(0, BOX_CARD_LIMIT)
  const badge = promo.badge ? BADGE_LABEL[promo.badge] : null
  const isHero = kind === 'hero'
  const heroArt = isHero && heroUrl

  return (
    <Pressable
      onPress={showCta ? openCta : undefined}
      accessibilityRole={showCta ? 'button' : undefined}
      accessibilityLabel={promo.title}
      style={[
        styles.card,
        {
          backgroundColor: Colors.$backgroundElevated,
          borderColor: Colors.rgba(accent, 0.35),
        },
      ]}
    >
      {/* The promo's colour washes the whole surface, strongest at the top. */}
      <LinearGradient
        pointerEvents="none"
        colors={[Colors.rgba(accent, 0.16) ?? accent, Colors.rgba(accent, 0.04) ?? accent]}
        style={StyleSheet.absoluteFill}
      />

      {heroArt ? (
        <View>
          <Image
            source={{ uri: heroUrl }}
            style={[styles.heroImage, { backgroundColor: Colors.$backgroundNeutral }]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          {badge ? (
            <View
              style={[
                styles.imageBadge,
                { backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.88) },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: accent }]} />
              <Text variant="stats" style={{ color: Colors.$textDefault }}>
                {badge.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.headerRow}>
          {!isHero && heroUrl ? (
            <Image
              source={{ uri: heroUrl }}
              style={[styles.thumb, { backgroundColor: Colors.$backgroundNeutral }]}
              contentFit="cover"
            />
          ) : null}
          <View style={{ flex: 1, gap: 4 }}>
            {/* The badge sits on the art when there is some; otherwise it's the eyebrow. */}
            {badge && !heroArt ? (
              <Text variant="stats" style={{ color: accent }}>
                {badge.toUpperCase()}
              </Text>
            ) : null}
            <Text variant={isHero ? 'h4' : 'large'} numberOfLines={2}>
              {promo.title}
            </Text>
            {promo.subtitle ? (
              <Text style={[styles.subtitle, { color: Colors.$textNeutral }]} numberOfLines={2}>
                {promo.subtitle}
              </Text>
            ) : null}
          </View>
          {!isHero && showCta ? (
            <View style={styles.inlineCta}>
              <Text variant="small" style={{ color: accent }}>
                {ctaLabel}
              </Text>
              <ChevronRight size={14} color={accent} />
            </View>
          ) : null}
        </View>

        {promo.body && promo.mode !== 'cards' ? (
          <Text
            style={[styles.bodyText, { color: Colors.$textNeutral }]}
            numberOfLines={isHero ? 4 : 2}
          >
            {promo.body}
          </Text>
        ) : null}

        {promo.mode === 'coming_soon' ? (
          <View style={styles.comingSoonRow}>
            {isHero ? (
              <CountdownBoxes iso={releaseIso} accent={accent} />
            ) : (
              <CountdownPill iso={releaseIso} accent={accent} />
            )}
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

        {isHero && showCta ? (
          <View
            style={[
              styles.ctaButton,
              {
                backgroundColor: Colors.rgba(accent, 0.2),
                borderColor: Colors.rgba(accent, 0.45),
              },
            ]}
          >
            <Text variant="small" style={{ color: Colors.$textDefault }}>
              {ctaLabel}
            </Text>
            <ChevronRight size={14} color={Colors.$iconDefault} />
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

/** Hero countdown: one box each for days, hours and minutes. */
function CountdownBoxes({ iso, accent }: { iso: string | null; accent: string }) {
  const parts = useCountdownParts(iso)
  if (!parts) return <DroppingSoon accent={accent} />
  const cells: [keyof CountdownParts, string][] = [
    ['days', 'days'],
    ['hours', 'hrs'],
    ['mins', 'min'],
  ]
  return (
    <View style={styles.countdownBoxes} accessibilityLabel={`Drops in ${formatParts(parts)}`}>
      {cells.map(([key, label]) => (
        <View
          key={key}
          style={[
            styles.countdownCell,
            {
              backgroundColor: Colors.rgba(accent, 0.12),
              borderColor: Colors.rgba(accent, 0.3),
            },
          ]}
        >
          <Text variant="stats-header" style={{ color: Colors.$textDefault, fontWeight: '700' }}>
            {String(parts[key]).padStart(2, '0')}
          </Text>
          <Text variant="stats" style={{ color: Colors.$textNeutral, fontSize: 10 }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** Rail countdown: one compact pill. */
function CountdownPill({ iso, accent }: { iso: string | null; accent: string }) {
  const label = useCountdown(iso)
  if (!label) return <DroppingSoon accent={accent} />
  return (
    <View style={[styles.countdownPill, { backgroundColor: Colors.rgba(accent, 0.12) }]}>
      <Clock size={12} color={accent} />
      <Text variant="stats" style={{ color: Colors.$textDefault }}>
        Drops in {label}
      </Text>
    </View>
  )
}

function DroppingSoon({ accent }: { accent: string }) {
  return (
    <Text variant="stats-header" style={{ color: accent }}>
      Dropping soon
    </Text>
  )
}

function formatParts({ days, hours, mins }: CountdownParts) {
  return `${days} days ${hours} hours ${mins} minutes`
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
          ? { backgroundColor: Colors.rgba(accent, 0.25), borderColor: Colors.rgba(accent, 0.45) }
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
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  imageBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  body: { padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  inlineCta: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 2 },
  subtitle: { fontSize: 14, lineHeight: 19 },
  bodyText: { fontSize: 14, lineHeight: 20 },
  comingSoonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  countdownBoxes: { flexDirection: 'row', gap: 6 },
  countdownCell: {
    minWidth: 48,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
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
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
})

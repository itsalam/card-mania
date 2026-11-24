import { useCollectionTotal } from '@/client/collections/query'
import { Text } from '@/components/ui/text/base-text'
import { formatCompactPrice } from '@/components/utils'
import { useCollectionHistory } from '@/features/collection/hooks'
import { OnboardingTarget } from '@/features/onboarding/OnboardingTarget'
import { useOnboardingStore } from '@/features/onboarding/OnboardingProvider'
import { TOURS } from '@/features/onboarding/steps'
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleProp, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import CollectionBreakdown from '../collection/components/CollectionBreakdown'
import { useCollapsibleHeaderEvent, useCollapsibleHeaderEvents } from '../collection/ui'
import { Graphs } from './Breakdowns'

const BORDER_COLOR_COLLAPSED = Colors.$outlineNeutral
const BORDER_COLOR_EXPANDED = Colors.$outlinePrimary
const BORDER_WIDTH = 2
const CHIP_HEIGHT = 24
const GRAPH_HEIGHT = 284
// CollectionBreakdown ~70px + Graphs ~284px + padding
// Open height until the breakdown has been measured (CollectionBreakdown ~70px + Graphs ~284px
// + padding); after that it opens to exactly its measured height, so nothing is cut off.
const BREAKDOWN_FALLBACK_HEIGHT = 400
const BREAKDOWN_TOGGLE_MS = 280

function StatCard({
  label,
  value,
  trend,
  caption,
}: {
  label: string
  value: string
  trend?: number | null
  caption?: string
}) {
  const trendColor =
    trend == null
      ? Colors.$textDefault
      : trend > 0
        ? Colors.green30
        : trend < 0
          ? Colors.red30
          : Colors.$textDefault
  const TrendIcon = trend == null || trend === 0 ? null : trend > 0 ? TrendingUp : TrendingDown

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.$backgroundNeutral,
        borderRadius: 12,
        padding: 12,
        gap: 4,
      }}
    >
      <Text variant="small" style={{ color: Colors.$textNeutral }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {TrendIcon && <TrendIcon size={14} color={trendColor} />}
        <Text variant="h4" style={{ color: trendColor }}>
          {value}
        </Text>
      </View>
      {caption ? (
        <Text
          variant="small"
          numberOfLines={1}
          style={{ color: Colors.$textNeutral, fontSize: 11 }}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  )
}

export function PortfolioSummary({
  selectedCollections,
  onToggleCollection,
  style,
}: {
  selectedCollections: string[]
  onToggleCollection: (type: string) => void
  style?: StyleProp<ViewStyle>
}) {
  const [expanded, setExpanded] = useState(false)
  // Closes with no animation after a dismiss-all, since the card is already off screen.
  const [instant, setInstant] = useState(false)
  // The breakdown's natural height (its content lays out fully even while clipped to 0), so
  // the collapsing header can be told how much the card is about to grow or shrink.
  const breakdownHeight = useRef(0)
  const [breakdownOpenHeight, setBreakdownOpenHeight] = useState(BREAKDOWN_FALLBACK_HEIGHT)
  const events = useCollapsibleHeaderEvents()

  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(settleTimer.current ?? undefined), [])

  // Source of truth for open/closed, updated on the tap itself. `expanded` state lags until the
  // next render, so rapid taps compared against it could report a change that never happened.
  const expandedRef = useRef(false)

  // Brackets a size change with 'resize' (the breakdown's absolute extra height, sent before the
  // layout moves) and 'resized' (once the maxHeight animation has finished), so the collapsing
  // header never measures the card mid-animation. The animation runs on the UI thread and fires
  // no layouts of its own, so the end is timed from its known duration; rapid toggles keep
  // pushing it back, so 'resized' only goes out once things are still.
  const reportSize = useCallback(
    (settleMs: number) => {
      const h = breakdownHeight.current
      events?.emit({ type: 'resize', extra: h > 0 ? (expandedRef.current ? h : 0) : undefined })
      if (settleTimer.current) clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(() => events?.emit({ type: 'resized' }), settleMs + 50)
    },
    [events]
  )

  const setOpen = useCallback(
    (next: boolean, opts?: { instant?: boolean }) => {
      if (next === expandedRef.current) return
      expandedRef.current = next
      const instantNext = Boolean(opts?.instant)
      setInstant(instantNext)
      setExpanded(next)
      reportSize(instantNext ? 0 : BREAKDOWN_TOGGLE_MS)
    },
    [reportSize]
  )

  // Open breakdown: one scroll dismisses the whole card. Once it's gone, close the breakdown so
  // the card comes back compact.
  useEffect(() => {
    events?.emit({ type: 'dismissible', value: expanded })
  }, [events, expanded])
  useEffect(() => () => events?.emit({ type: 'dismissible', value: false }), [events])
  useCollapsibleHeaderEvent((event) => {
    if (event.type === 'dismissed') setOpen(false, { instant: true })
  })

  // The tour's "Track Your Items" step spotlights the expanded breakdown, which is clipped while
  // collapsed — open it when the tour reaches that step.
  const graphsStepActive = useOnboardingStore(
    (s) => s.active && TOURS[s.tourId][s.currentIndex]?.id === 'collection-graphs'
  )
  useEffect(() => {
    if (graphsStepActive) setOpen(true)
  }, [graphsStepActive, setOpen])

  // ITS-123: Total Value is what you own. Triggers mirror every Selling item into the Vault,
  // so the Vault already includes what's for sale (adding Selling counted it twice), and
  // Wishlist cards aren't owned. Selling is shown as a share of the total; Wishlist stays in
  // the breakdown below.
  const { data: sellingTotal = 0 } = useCollectionTotal({ collectionType: 'selling' })
  const { data: vaultTotal = 0 } = useCollectionTotal({ collectionType: 'vault' })
  const { data: vaultHistory } = useCollectionHistory({ collectionType: 'vault' })

  const totalValue = vaultTotal
  const forSaleCaption =
    sellingTotal > 0 ? `incl. ${formatCompactPrice(sellingTotal)} for sale` : undefined

  const cardCount = vaultHistory?.[vaultHistory.length - 1]?.quantity_total ?? 0

  const pctChange = useMemo(() => {
    const byDay = new Map<string, number>()
    vaultHistory?.forEach(({ snapshotted_at, total_cents }) => {
      const d = new Date(snapshotted_at)
      d.setHours(0, 0, 0, 0)
      // Several snapshots in a day: keep the latest (history is oldest first).
      byDay.set(String(d.getTime()), total_cents)
    })

    const sorted = [...byDay.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
    if (sorted.length < 2) return null
    const oldest = sorted[0][1]
    const newest = sorted[sorted.length - 1][1]
    if (!oldest) return null
    return ((newest - oldest) / oldest) * 100
  }, [vaultHistory])

  const pctLabel = pctChange != null ? `${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%` : '—'

  const ChevronIcon = expanded ? ChevronUp : ChevronDown

  return (
    <View style={style}>
      {/* Single bordered card containing all content */}
      <MotiView
        animate={{ borderColor: expanded ? BORDER_COLOR_EXPANDED : BORDER_COLOR_COLLAPSED }}
        transition={{ type: 'timing', duration: instant ? 0 : BREAKDOWN_TOGGLE_MS }}
        style={{
          borderWidth: BORDER_WIDTH,
          borderRadius: 20,
          padding: 12,
          paddingBottom: 12 + CHIP_HEIGHT / 2,
        }}
      >
        {/* Stat cards — always visible */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatCard
            label="Total Value"
            value={formatCompactPrice(totalValue)}
            caption={forSaleCaption}
          />
          <StatCard label="Cards" value={String(cardCount)} />
          <StatCard label="Change" value={pctLabel} trend={pctChange} />
        </View>

        {/* Accordion — expands inside the card; outer page ScrollView handles scrolling */}
        <MotiView
          animate={{ maxHeight: expanded ? breakdownOpenHeight : 0, opacity: expanded ? 1 : 0 }}
          transition={{ type: 'timing', duration: instant ? 0 : BREAKDOWN_TOGGLE_MS }}
          style={{ overflow: 'hidden' }}
        >
          {/* The whole expanded breakdown is the tour's "Track Your Items" spotlight. */}
          <OnboardingTarget id="collection-graphs">
            <View
              onLayout={(e) => {
                const h = Math.ceil(e.nativeEvent.layout.height)
                if (h === breakdownHeight.current) return
                breakdownHeight.current = h
                if (h > 0) setBreakdownOpenHeight(h)
                // Content grew or shrank while open (e.g. the charts loaded): the header's
                // height changes with it.
                if (expandedRef.current) reportSize(BREAKDOWN_TOGGLE_MS)
              }}
            >
              <CollectionBreakdown
                selectedCollections={selectedCollections}
                onToggleCollection={onToggleCollection}
                style={{ paddingTop: 12, paddingBottom: 8, paddingHorizontal: 4 }}
              />
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: BORDER_COLOR_COLLAPSED,
                  marginTop: 4,
                  overflow: 'hidden',
                  borderRadius: 12,
                }}
              >
                <Graphs height={GRAPH_HEIGHT} selectedCollections={selectedCollections} />
              </View>
            </View>
          </OnboardingTarget>
        </MotiView>
      </MotiView>

      {/* Chip straddling the bottom border of the card */}
      <View style={{ alignItems: 'center', marginTop: -(CHIP_HEIGHT / 2 + BORDER_WIDTH) }}>
        <Pressable
          onPress={() => setOpen(!expandedRef.current)}
          style={{
            height: CHIP_HEIGHT,
            borderRadius: 99,
            paddingHorizontal: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: expanded ? BORDER_COLOR_EXPANDED : BORDER_COLOR_COLLAPSED,
          }}
        >
          <Text variant="small" style={{ color: Colors.$textDefault, lineHeight: CHIP_HEIGHT }}>
            View breakdown
          </Text>
          <ChevronIcon size={12} color={Colors.$textDefault} />
        </Pressable>
      </View>
    </View>
  )
}

import { Text } from '@/components/ui/text/base-text'
import { ShoppingCart } from 'lucide-react-native'
import { StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

/**
 * Shared visual content for "open the cart" buttons — the app-wide floating pill
 * (app/(tabs)/_layout.tsx's FloatingCartButton) and DetailCardView's footer Cart button both
 * render this so the two stay in lockstep (same icon, "View Cart" label, count badge) instead of
 * two hand-copied implementations quietly drifting apart. Callers own their own outer
 * Pressable/TouchableOpacity and its surface styling (border/background/shape) — this is content
 * only, laid out via cartButtonContentLayout below.
 */
export function CartButtonContent({ count }: { count: number }) {
  return (
    <>
      <ShoppingCart size={18} color={Colors.$iconDefault} />
      <Text style={[cartButtonStyles.label, { color: Colors.$textDefault }]}>View Cart</Text>
      <CartCountBadge count={count} />
    </>
  )
}

/** The cart-count notification blip — shared by CartButtonContent above and the footer's own
 *  bare cart icon (features/tcg-card-views/DetailCardView/footer/footer.tsx), which positions
 *  this absolutely at the icon's corner rather than inline. Previously each hand-copied its own
 *  badge/text styles (a stray `lineHeight` on the text was fighting the flex-centered container,
 *  reading as visibly off-center) — one definition here so both stay identical and centered. */
export function CartCountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <View style={[cartButtonStyles.badge, { backgroundColor: Colors.$outlinePrimary }]}>
      <Text style={cartButtonStyles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  )
}

/** Shared exact height for every DetailCardView footer button (Collection, the Wishlist square,
 *  Menu) and both cart buttons (the floating pill, the footer's own) — without an explicit
 *  height, the floating pill was purely padding/content-derived while the footer buttons relied
 *  on Tailwind's `min-h-11` (a minimum, not a fixed value), so the two could only ever match by
 *  coincidence. Pin everything to this one value instead. */
export const CART_BUTTON_HEIGHT = 44

/** Apply to whatever Pressable/TouchableOpacity directly wraps CartButtonContent — the content's
 *  own row/gap/padding, not the outer surface (border/background/radius), which each caller sets
 *  itself since it composes with unrelated concerns (the floating pill's absolute positioning and
 *  shadow, the footer button's row placement). */
export const cartButtonContentLayout = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 6,
  height: CART_BUTTON_HEIGHT,
  paddingHorizontal: 18,
}

const cartButtonStyles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 99,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    // No explicit lineHeight — a fixed lineHeight doesn't align to this font's actual glyph
    // metrics, which is what read as "off-center" against the badge's flex-centered container.
    // includeFontPadding:false strips Android's default extra vertical glyph padding, the other
    // half of the same symptom; iOS centers correctly without it and ignores the prop.
    includeFontPadding: false,
  },
})

import { Colors } from 'react-native-ui-lib'

export const CARD_ASPECT_RATIO = 5 / 7

/** Shared title styling for top-level tab page headers (Market, Home, Collections) —
 *  keep these in sync so every tab's header reads as one system. Source of truth:
 *  Marketplace's original header (`features/marketplace/index.tsx`). */
export const PAGE_HEADER_CONTAINER_STYLE = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingHorizontal: 16,
  paddingTop: 20,
  paddingBottom: 12,
}

export const PAGE_HEADER_TITLE_STYLE = {
  fontSize: 34,
  // The shared Text component always carries NativeWind's `text-base` class
  // (fontSize 16 / lineHeight 24) as its className base; without an explicit
  // lineHeight here that 24px line box clips the 34px glyphs top and bottom.
  lineHeight: 40,
  fontWeight: '800' as const,
  letterSpacing: -0.5,
  textAlign: 'left' as const,
  color: Colors.$textDefault,
}

/** Extra breathing room added below the floating tab bar's own measured height
 *  (`useBottomTabBarHeight()`) for tab-page scroll content bottom padding. */
export const TAB_CONTENT_BOTTOM_SPACING = 24

export const Z_INDEX = {
  BLUR: 1,
  SEARCH_BAR: 50,
  SEARCH_BAR_OVERLAY: 49,
  ACTIVE_TAB: 10,
  FAB: 50,
  FAB_MENU: 51,
  DROPDOWN_MENU: 40,
}

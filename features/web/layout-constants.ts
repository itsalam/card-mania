export const NAV_HEIGHT = 56
export const NAV_TOP = 6 // fixed top offset from viewport
export const NAV_MARGIN_H = 96 // horizontal margin of the nav pill
export const NAV_PADDING_H = 12 // inner horizontal padding of the nav pill
export const NAV_LOGO_SIZE = 44 // logo image dimensions

// Vertical space to clear the nav bar (used for paddingTop in sticky children)
export const NAV_CLEARANCE = NAV_TOP * 2 + NAV_HEIGHT // 80px

// X-center of the CM logo from the viewport left edge
// = NAV_MARGIN_H + NAV_PADDING_H + NAV_LOGO_SIZE / 2 = 54px
export const LOGO_CENTER_X = NAV_PADDING_H + NAV_LOGO_SIZE / 2

// Collapsed sidebar width that centers the avatar directly under the logo
export const SIDEBAR_COLLAPSED_WIDTH = LOGO_CENTER_X * 2 // 108px
export const SIDEBAR_EXPANDED_WIDTH = 280

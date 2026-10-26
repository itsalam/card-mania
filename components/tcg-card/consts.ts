export const THUMBNAIL_WIDTH = 96
export const THUMBNAIL_HEIGHT = Math.round(96 / (5 / 7))

export const CARD_ASPECT_RATIO = 5 / 7

// Card lists (glass rows in collection, storefront, marketplace, search, expanded home sections).
// Smaller than THUMBNAIL_WIDTH, which still sizes gallery/featured/carousel art.
export const LIST_THUMBNAIL_WIDTH = 72
export const LIST_THUMBNAIL_HEIGHT = Math.round(LIST_THUMBNAIL_WIDTH / CARD_ASPECT_RATIO)
/** Inner padding of a glass list row (ItemListView). */
export const CARD_LIST_ROW_PADDING = 10
/** Spacing between cards in any card list or grid. */
export const CARD_LIST_GAP = 8

// The DetailCardView hero image's width, as a fraction of the window width — lives here (a
// lightweight, dependency-free consts file) rather than only in DetailCardView/index.tsx itself,
// so components/tcg-card/placeholders.tsx's app-load prefetch can size its warmed placeholder to
// match without pulling that whole (heavy) module into its own import graph.
export const CARD_WIDTH_RATIO = 0.65

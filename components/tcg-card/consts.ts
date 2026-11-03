export const THUMBNAIL_WIDTH = 96
export const THUMBNAIL_HEIGHT = Math.round(96 / (5 / 7))

export const CARD_ASPECT_RATIO = 5 / 7

/** Card art corner radius as a fraction of its width — a physical card's ~1/8" corner on its 2.5"
 *  width is 0.05; slightly tighter here so small thumbnails stay crisp. */
export const CARD_ART_RADIUS_RATIO = 0.04
/** Corner radius for card art of a given width, so every image size keeps the same proportions. */
export const cardArtRadius = (width: number) =>
  Math.max(2, Math.round(width * CARD_ART_RADIUS_RATIO))

// Default card size: the collapsed home tile (CardTile). Glass list rows (collection, storefront,
// marketplace, search, expanded home sections) use the same art width, padding and radii so a
// card looks the same whether it's in a carousel or a list.
export const LIST_THUMBNAIL_WIDTH = 120
export const LIST_THUMBNAIL_HEIGHT = Math.round(LIST_THUMBNAIL_WIDTH / CARD_ASPECT_RATIO)
/** Inset between a glass row/tile edge and the card art. */
export const CARD_LIST_ROW_PADDING = 6
/** Corner radius of the default-size art, and of the glass row/tile around it — concentric with
 *  the art (art radius + padding) so the inset reads even all the way round. */
export const LIST_THUMBNAIL_RADIUS = cardArtRadius(LIST_THUMBNAIL_WIDTH)
export const CARD_LIST_ROW_RADIUS = LIST_THUMBNAIL_RADIUS + CARD_LIST_ROW_PADDING
/** Spacing between cards in any card list or grid. */
export const CARD_LIST_GAP = 8

// The DetailCardView hero image's width, as a fraction of the window width — lives here (a
// lightweight, dependency-free consts file) rather than only in DetailCardView/index.tsx itself,
// so components/tcg-card/placeholders.tsx's app-load prefetch can size its warmed placeholder to
// match without pulling that whole (heavy) module into its own import graph.
export const CARD_WIDTH_RATIO = 0.65

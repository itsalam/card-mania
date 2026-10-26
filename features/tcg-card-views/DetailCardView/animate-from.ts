import { CARD_ASPECT_RATIO, CARD_WIDTH_RATIO } from '@/components/tcg-card/consts'
import { Dimensions } from 'react-native'

export type AnimateFromRect = { x: number; y: number; width: number; height: number }

/**
 * The detail routes animate in from the tapped tile's measured rect, passed as a JSON `from`
 * param by useNavigateToItem. Deep links (notification action_urls, pasted URLs) have no tile,
 * so fall back to a centred card-sized rect — the entrance then grows in place instead of
 * JSON.parse(undefined) crashing the screen.
 */
export function parseAnimateFrom(from?: string | null): AnimateFromRect {
  if (from) {
    try {
      const rect = JSON.parse(from)
      if (rect && typeof rect.x === 'number' && typeof rect.width === 'number') return rect
    } catch {
      // fall through to the centred default
    }
  }
  const { width: W, height: H } = Dimensions.get('window')
  const width = W * CARD_WIDTH_RATIO
  const height = width / CARD_ASPECT_RATIO
  return { x: (W - width) / 2, y: (H - height) / 3, width, height }
}

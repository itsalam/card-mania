import { Dimensions } from 'react-native'

export const TIME_PERIODS = ['1W', '1M', '3M', '1Y', 'all']

export const TIME_PERIODS_DURATION: Record<string, number> = {
  '1W': 1000 * 60 * 60 * 24 * 7,
  '1M': 1000 * 60 * 60 * 24 * 30,
  '3M': 1000 * 60 * 60 * 24 * 90,
  '1Y': 1000 * 60 * 60 * 24 * 365,
}

// Cached once at module level — avoids re-calling on every render when width is not passed.
export const WINDOW_WIDTH = Dimensions.get('window').width

export const DAY_MS = 86_400_000

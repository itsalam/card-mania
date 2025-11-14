import { useColorScheme } from '@/lib/hooks/useColorScheme'
import { ColorValue, View } from 'react-native'
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'

export type OptionalColorValue = ColorValue | null
export type ColorValueArray = [ColorValue, ColorValue, ...ColorValue[]]
export type OptionalColorValueArray = [
  OptionalColorValue,
  OptionalColorValue,
  ...OptionalColorValue[]
]

export function hexToRgba(hex: string, opacity: number): string {
  // Remove leading # if present
  hex = hex.replace(/^#/, '')

  // Handle short form (#fff → #ffffff)
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }

  if (hex.length !== 6) {
    throw new Error('Invalid hex color.')
  }

  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

// export const getBackgroundColors = (colorScheme: ColorSchemeName): ColorValueArray => colorScheme === 'dark' ? ['#1C1C1C', '#0C0C0C'] : ['#E0E0E0', '#F5F5F5'];

export const useBackgroundColors = (): ColorValueArray => {
  const { colorScheme } = useColorScheme()
  // const defaultColors: ColorValueArray = getBackgroundColors(colorScheme);
  const defaultColors: ColorValueArray = [
    Colors.$backgroundNeutralMedium,
    Colors.$backgroundNeutralLight,
  ]
  return defaultColors
}

export const formatPrice = (
  price: number,
  {
    currency = '$',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  }: { currency?: string; minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string => {
  return `${currency}${(price / 100).toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  })}`
}

export const formatLabel = (label: string): string => {
  return label
    .replace(/_/g, '.')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .toLocaleUpperCase()
}

export function measureAsync(
  ref: React.RefObject<View>
): Promise<{ x: number; y: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const node = ref.current as any
    if (!node?.measure) {
      return reject(new Error('measure missing'))
    }
    node.measure((x: number, y: number, width: number, height: number) => {
      console.debug('measured:', { x, y, width, height })
      resolve({ x, y, width, height })
    })
  })
}

type Opts = {
  /** only log when value actually changes (default: true) */
  distinct?: boolean
  /** throttle logs (ms). 0 = no throttle */
  throttleMs?: number
  enable?: boolean
}

export function useSharedValueLogger<T>(label: string, shared: { value: T }, opts: Opts = {}) {
  const { distinct = true, throttleMs = 0, enable = true } = opts

  // helper defined outside worklet
  const log = (msg: string, curr: T, prev: T | null) => {
    // Metro console
    enable && console.log(msg, curr, '(prev:', prev, ')')
  }

  useAnimatedReaction(
    () => shared.value,
    (curr, prev) => {
      'worklet'
      // distinct guard
      if (distinct && prev !== null && curr === prev) return

      // simple time-based throttle (optional)
      if (throttleMs > 0) {
        const key = `__svlog_${label}`
        // @ts-expect-error
        const last = globalThis[key] ?? 0
        const now = Date.now() // works in worklets
        if (now - last < throttleMs) return
        // @ts-expect-error
        globalThis[key] = now
      }

      runOnJS(log)(`[SV:${label}]`, curr, prev ?? null)
    },
    // deps for label/options (safe to pass; they live on JS thread)
    [label, distinct, throttleMs]
  )
}

export function splitToNChunks(array: readonly any[], n: number, minSize: number = -1) {
  const copy = [...array]
  let result = []
  for (let i = n; i > 0; i--) {
    result.push(copy.splice(0, Math.max(Math.ceil(copy.length / i), minSize)))
  }
  return result
}

export function chunk<T>(arr: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error('size must be > 0')
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

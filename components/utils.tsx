import { useColorScheme } from '@/hooks/useColorScheme'
import { ColorValue } from 'react-native'
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
    Colors.$backgroundNeutral,
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

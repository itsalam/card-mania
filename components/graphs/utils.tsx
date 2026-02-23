import { SkFont } from '@shopify/react-native-skia'

export const getFontHeight = (font: SkFont | null) => {
  const { ascent, descent } = font?.getMetrics() || { ascent: 0, descent: 0 } // ascent is negative
  return -ascent + descent
}

export const wrapContent = (
  width: number,
  height: number,
  { padX = 8, padY = 4, radius = 6 }: { padX?: number; padY?: number; radius?: number }
) => {
  return {
    width: width + padX * 2,
    height: height + padY * 2,
    radius: radius,
  }
}

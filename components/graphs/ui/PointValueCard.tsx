import { formatPrice } from '@/components/utils'
import { Group, RoundedRect, Text, useFont } from '@shopify/react-native-skia'
import React from 'react'
import {
  SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { getFontHeight, wrapContent } from '../utils'
import { SeriesPoint } from './types'

type PointValueCardProps = {
  cx: SharedValue<number> // shared x (in pixels)
  cy: SharedValue<number> // shared y (in pixels)
  label: string
  valueSV: SharedValue<number> // the numeric value to show (y or formatted)
  formatValue?: (n: number) => string
  restPoint: SeriesPoint
  canvasWidth: number
  canvasTop: number
  canvasBottom: number
  isActive: boolean
  offset?: { x: number; y: number } // offset from the point
  textColor?: string
  valueOverride?: number
}

export function PointValueCard({
  cx,
  cy,
  valueSV,
  formatValue = formatPrice,
  restPoint,
  label,
  canvasWidth,
  canvasTop,
  canvasBottom,
  offset = { x: 8, y: 0 },
  textColor = Colors.$textGeneral,
  valueOverride,
  isActive,
}: PointValueCardProps) {
  // 1) load a font (must be a real .ttf/.otf file in your bundle)
  const priceFont = useFont(require('../../../assets/fonts/SpaceMono-Regular.ttf'), 12)
  const labelFont = useFont(require('../../../assets/fonts/SpaceMono-Regular.ttf'), 9)
  const setFormattedLabel = React.useCallback(
    (n: number) => {
      const fallback = restPoint?.yValue ?? (0 as number)
      setValueText(formatValue(isActive ? n : fallback)) // JS thread
    },
    [formatValue, isActive, restPoint?.yValue]
  )

  // 2) keep a React label string synced from the UI-thread SharedValue
  const [valueText, setValueText] = React.useState(formatValue(restPoint?.yValue ?? (0 as number)))
  useAnimatedReaction(
    () => ({ v: valueSV.value, active: isActive }),
    ({ v, active }) => {
      'worklet'
      const display = active
        ? v
        : (valueOverride ?? (restPoint?.yValue as number) ?? (restPoint?.y as number) ?? 0)
      scheduleOnRN(setFormattedLabel, display)
    },
    [isActive, valueOverride]
  )

  React.useEffect(() => {
    if (!isActive) {
      const display =
        valueOverride ?? (restPoint?.yValue as number) ?? (restPoint?.y as number) ?? 0
      setValueText(formatValue(display))
    }
  }, [isActive, valueOverride, restPoint?.yValue, restPoint?.y, formatValue])

  // 3) measure text (once font loaded); fall back widths if not ready

  const textWidth = priceFont ? priceFont.measureText(valueText).width : 40
  const labelWidth = labelFont ? labelFont.measureText(valueText).width : 40
  const textHeight = getFontHeight(priceFont)
  const labelHeight = getFontHeight(labelFont)
  const {
    width: cardW,
    height: cardH,
    radius,
  } = wrapContent(Math.max(textWidth, labelWidth), textHeight + labelHeight, {})

  const x = useDerivedValue(
    () => withTiming(isActive ? cx.value : restPoint?.x, { duration: 20 }),
    [cx, isActive, restPoint]
  )
  const y = useDerivedValue(() => {
    const rawY = isActive ? cy.value : (restPoint?.y ?? 0)
    const chartHeight = canvasBottom - canvasTop
    const minAllowedY = canvasBottom - chartHeight * 0.7 // cap at top 20% buffer
    const cappedY = Math.max(minAllowedY, Math.min(rawY, canvasBottom))
    return withTiming(cappedY, { duration: 20 })
  }, [cy, isActive, restPoint, canvasBottom, canvasTop])

  const cardX = useDerivedValue(
    () => withTiming(x.value + offset.x, { duration: 20 }),
    [cx, offset]
  )
  const cardY = useDerivedValue(
    () => withTiming(y.value + offset.y - cardH / 2, { duration: 20 }),
    [cy, cardH, offset, priceFont]
  )

  // 4) compute static y bounds and cap later at render time
  const minY = canvasTop + 4
  const maxY = canvasBottom - cardH - 4

  // We can’t compute final x/y in React from SharedValues; just do simple anchoring
  // and let Skia place the group using cx/cy plus fixed offsets.
  // For edge-clamping on X, do a tiny onJS mirror of cx if you need it dynamic.

  const textY = useDerivedValue(
    () => cardY.value + cardH - textHeight / 2,
    [cardY, cardH, textHeight, labelHeight]
  )
  const textX = useDerivedValue(
    () => cardX.value + cardW / 2 - textWidth / 2,
    [cardX, cardW, textWidth, priceFont]
  )

  const labelY = useDerivedValue(
    () => cardY.value + cardH - textHeight - labelHeight / 2,
    [cardY, cardH, textHeight, labelHeight]
  )
  const labelX = useDerivedValue(
    () => cardX.value + cardW - labelWidth,
    [cardX, cardW, labelWidth, priceFont]
  )

  return priceFont ? (
    <Group
      // anchor the card near the dot (no hooks here)
      transform={[{ translateX: 0 }, { translateY: 0 }]}
    >
      {/* Background with rounded corners.
         We compute x/y in drawspace by shifting card relative to the circle.
         Skia supports SharedValue<number> directly for numeric props. */}
      <RoundedRect
        x={cardX} // left at cx + offset.x, but RoundedRect wants a number
        y={cardY}
        width={cardW}
        height={cardH}
        r={radius}
        color={Colors.$backgroundNeutral}
        opacity={0.75}
      />
      <Text text={label} x={labelX} y={labelY} font={labelFont} color={textColor} />
      <Text text={valueText} x={textX} y={textY} font={priceFont} color={textColor} />
    </Group>
  ) : null
}

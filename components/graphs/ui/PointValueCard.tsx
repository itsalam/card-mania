import { formatLabel } from '@/components/utils'
import { fmtCardValue } from '../helpers'
import {
  DashPathEffect,
  Group,
  Path,
  RoundedRect,
  Skia,
  Text,
  useFont,
} from '@shopify/react-native-skia'
import React, { useMemo } from 'react'
import {
  SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { getFontHeight, wrapContent } from '../utils'
import { SeriesDot } from './SeriesDot'
import { SeriesPoint } from './types'

type PointValueCardProps = {
  cx: SharedValue<number> // shared x (in pixels)
  cy: SharedValue<number> // shared y (in pixels)
  label: string
  valueSV: SharedValue<number> // the numeric value to show (y or formatted)
  formatValue?: (n: number) => string
  restPoint?: SeriesPoint
  canvasTop: number
  canvasBottom: number
  isActive: boolean
  offset?: { x: number; y: number } // offset from the point
  textColor?: string
  valueOverride?: number
  /** Collision-resolved Y positions for all series cards (worklet-safe array). */
  adjustedPositions?: SharedValue<number[]>
  /** Index of this card in the adjustedPositions array. */
  seriesIndex?: number
  /** Pixel x of the last real data point — beyond this the series is extrapolated. */
  lastDataX?: number
}

export function PointValueCard({
  cx,
  cy,
  valueSV,
  formatValue = fmtCardValue,
  restPoint,
  label,
  canvasTop,
  canvasBottom,
  offset = { x: 8, y: 0 },
  textColor = Colors.$textGeneral,
  valueOverride,
  isActive,
  adjustedPositions,
  seriesIndex,
  lastDataX,
}: PointValueCardProps) {
  // 1) load a font (must be a real .ttf/.otf file in your bundle)
  const priceFont = useFont(require('../../../assets/fonts/SpaceMono-Regular.ttf'), 12)
  const labelFont = useFont(require('../../../assets/fonts/SpaceMono-Regular.ttf'), 10)
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
    () => ({ v: valueSV.value, active: isActive, curX: cx.value }),
    ({ v, active, curX }) => {
      'worklet'
      // Treat non-finite v (NaN from CartesianChart for dates with no series data) the same
      // as extrapolated — fall back to the last-known override value.
      const inExtrapolated = (lastDataX !== undefined && curX > lastDataX) || !isFinite(v)
      const safeOverride =
        typeof valueOverride === 'number' && isFinite(valueOverride) ? valueOverride : undefined
      const safeYValue =
        typeof restPoint?.yValue === 'number' && isFinite(restPoint!.yValue as number)
          ? (restPoint!.yValue as number)
          : undefined
      const display = active && !inExtrapolated ? v : (safeOverride ?? safeYValue ?? 0)
      scheduleOnRN(setFormattedLabel, display)
    },
    [isActive, valueOverride, lastDataX]
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
  const labelWidth = labelFont ? labelFont.measureText(label).width : 40
  const textHeight = getFontHeight(priceFont)
  const labelHeight = getFontHeight(labelFont)
  const {
    width: cardW,
    height: cardH,
    radius,
  } = wrapContent(Math.max(textWidth, labelWidth), textHeight + labelHeight - 4, {
    padX: 8,
    padY: 4,
  })

  // cx (= targetX from ToolTip) is already animated — derive cardX directly so the
  // card tracks the crosshair with no extra lag.
  const cardX = useDerivedValue(() => cx.value + offset.x, [cx, offset])

  const y = useDerivedValue(() => {
    const inExtrapolated = lastDataX !== undefined && cx.value > lastDataX
    // Use collision-resolved position when provided; fall back to raw series Y.
    const rawY =
      adjustedPositions && seriesIndex !== undefined
        ? adjustedPositions.value[seriesIndex]
        : isActive && !inExtrapolated
          ? cy.value
          : (restPoint?.y ?? 0)
    return withSpring(Math.max(canvasTop, Math.min(rawY, canvasBottom)), {
      mass: 0.6,
      damping: 18,
      stiffness: 180,
    })
  }, [
    cx,
    cy,
    isActive,
    restPoint,
    canvasBottom,
    canvasTop,
    adjustedPositions,
    seriesIndex,
    lastDataX,
  ])

  const cardY = useDerivedValue(() => y.value + (offset?.y ?? 0) - cardH / 2, [y, cardH, offset])

  // Raw dot Y — the series' actual line position before collision offset
  const dotY = useDerivedValue(() => {
    const inExtrapolated = lastDataX !== undefined && cx.value > lastDataX
    return isActive && !inExtrapolated ? cy.value : (restPoint?.y ?? 0)
  }, [cx, cy, isActive, restPoint, lastDataX])

  // Cardinal connector: vertical from dot to card's Y, then horizontal to card left edge
  const connectorSkPath = useMemo(() => Skia.Path.Make(), [])
  const connectorPath = useDerivedValue(() => {
    connectorSkPath.reset()
    const startX = cx.value
    const startY = dotY.value
    const endX = cardX.value
    const endY = cardY.value + cardH / 2

    const dy = endY - startY
    const dx = endX - startX

    if (Math.abs(dy) < 1 || Math.abs(dx) < 1) {
      connectorSkPath.moveTo(startX, startY)
      connectorSkPath.lineTo(endX, endY)
    } else {
      const R = Math.min(Math.abs(dx), Math.abs(dy), 5)
      const signDy = dy > 0 ? 1 : -1
      const signDx = dx > 0 ? 1 : -1
      connectorSkPath.moveTo(startX, startY)
      connectorSkPath.lineTo(startX, endY - R * signDy)
      connectorSkPath.quadTo(startX, endY, startX + R * signDx, endY)
      connectorSkPath.lineTo(endX, endY)
    }

    return connectorSkPath
  }, [cx, dotY, cardX, cardY])

  const textY = useDerivedValue(
    () => cardY.value + cardH - textHeight / 2,
    [cardY, cardH, textHeight, labelHeight]
  )
  const textX = useDerivedValue(() => cardX.value + 8, [cardX, cardW, textWidth, priceFont])

  const labelY = useDerivedValue(
    () => cardY.value + 4 + labelHeight / 2,
    [cardY, cardH, textHeight, labelHeight]
  )
  const labelX = useDerivedValue(() => cardX.value + 8, [cardX, cardW, labelWidth, priceFont])

  return priceFont ? (
    <Group
      // anchor the card near the dot (no hooks here)
      transform={[{ translateX: 0 }, { translateY: 0 }]}
    >
      <SeriesDot
        isActive={isActive}
        x={cx}
        posY={dotY}
        restY={restPoint?.y ?? 0}
        color={textColor as any}
      />
      {/* Dashed connector from dot to card */}
      <Path
        path={connectorPath}
        style="stroke"
        strokeWidth={1.5}
        color={Colors.rgba(textColor, 0.5)}
      >
        <DashPathEffect intervals={[3, 2]} />
      </Path>
      {/* Outer shadow layer for depth */}
      <RoundedRect
        x={cardX}
        y={cardY}
        width={cardW}
        height={cardH}
        r={radius}
        color={Colors.rgba(textColor, 0.4)}
        style="stroke"
        strokeWidth={5}
      />
      {/* Main card background */}
      <RoundedRect
        x={cardX}
        y={cardY}
        width={cardW}
        height={cardH}
        r={radius}
        color={Colors.$backgroundElevatedLight}
        opacity={0.9}
      />
      <Text text={formatLabel(label)} x={labelX} y={labelY} font={labelFont} color={textColor} />
      <Text text={valueText} x={textX} y={textY} font={priceFont} color={textColor} />
    </Group>
  ) : null
}

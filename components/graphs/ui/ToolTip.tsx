import { Rect, RoundedRect, Text, useFont } from '@shopify/react-native-skia'
import React, { Fragment, useMemo, useState } from 'react'
import {
  Easing,
  SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { WINDOW_WIDTH } from '../constants'
import { fmtCardValue } from '../helpers'
import { getFontHeight, wrapContent } from '../utils'
import { PointValueCard } from './PointValueCard'
import { InputFieldType, SeriesPoint, SeriesSV } from './types'

type BreakGap = { topPx: number; bottomPx: number; label: string }

type ToolTipProps = {
  isActive: boolean
  seriesActive?: boolean
  x: SharedValue<number>
  yKeys: Record<string, SeriesSV>
  bottom: number
  top: number
  left?: number
  right?: number
  xValue: SharedValue<number>
  fontSize?: number
  topOffset?: number
  restPoints: Record<string, SeriesPoint>
  color?: string
  colors?: string[]
  /** When the chart uses piecewise normalisation, inverse-transform values before display. */
  valueDenorm?: (n: number) => number
  showLabel?: boolean
  breakGaps?: BreakGap[]
}

export function ToolTip({
  isActive,
  seriesActive,
  x,
  yKeys,
  bottom,
  top,
  left = 0,
  right = WINDOW_WIDTH,
  xValue,
  restPoints,
  color,
  colors,
  valueDenorm,
  showLabel = true,
  breakGaps,
}: ToolTipProps) {
  const font = useFont(require('../../../assets/fonts/Inter.ttf'), 12)
  const seriesKeys = useMemo(() => Object.keys(yKeys ?? {}), [yKeys])
  const seriesIsActive = seriesActive ?? isActive

  // Collision-resolved Y positions using symmetric group centering.
  const COLLISION_CARD_H = 38
  const COLLISION_GAP = 4
  const STEP = COLLISION_CARD_H + COLLISION_GAP

  const seriesPositions = useMemo(
    () => seriesKeys.map((k) => yKeys[k].position),
    [seriesKeys, yKeys]
  )
  const seriesRestYs = useMemo(
    () => seriesKeys.map((k) => restPoints[k]?.y ?? 0),
    [seriesKeys, restPoints]
  )

  const adjustedPositions = useDerivedValue(() => {
    const rawYs: number[] = seriesPositions.map((posSV, i) =>
      seriesIsActive ? posSV.value : seriesRestYs[i]
    )
    const n = rawYs.length
    if (n <= 1) return rawYs

    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => rawYs[a] - rawYs[b])
    const adjusted = rawYs.slice()

    let gStart = 0
    while (gStart < n) {
      let gEnd = gStart
      while (gEnd + 1 < n && rawYs[order[gEnd + 1]] - rawYs[order[gEnd]] < STEP) {
        gEnd++
      }
      const gSize = gEnd - gStart + 1
      if (gSize > 1) {
        let sumY = 0
        for (let g = gStart; g <= gEnd; g++) sumY += rawYs[order[g]]
        const centerY = sumY / gSize
        const span = (gSize - 1) * STEP
        const maxStart = bottom - COLLISION_CARD_H - span
        const startY = Math.max(top, Math.min(centerY - span / 2, maxStart))
        for (let g = 0; g < gSize; g++) {
          adjusted[order[gStart + g]] = startY + g * STEP
        }
      }
      gStart = gEnd + 1
    }

    // Forward pass: push any card still too close to the one above it down
    for (let j = 1; j < n; j++) {
      const prev = order[j - 1]
      const curr = order[j]
      if (adjusted[curr] - adjusted[prev] < STEP) adjusted[curr] = adjusted[prev] + STEP
    }

    // Backward pass: pull chain back up if it overflowed bottom
    for (let j = n - 1; j >= 0; j--) {
      adjusted[order[j]] = Math.min(adjusted[order[j]], bottom - COLLISION_CARD_H)
      if (j > 0) {
        const prev = order[j - 1]
        const curr = order[j]
        if (adjusted[curr] - adjusted[prev] < STEP) adjusted[prev] = adjusted[curr] - STEP
      }
    }

    // Final top clamp
    for (let i = 0; i < n; i++) adjusted[i] = Math.max(top, adjusted[i])

    return adjusted
  }, [seriesIsActive, seriesRestYs])

  const [xValueText, setXValueText] = useState('')

  const restP = useMemo(() => {
    let mx = -Infinity
    const points = Object.values(restPoints)
    let resultP: SeriesPoint | undefined = points[points.length - 1]
    for (const p of points) {
      if (p?.x && p.x > mx) {
        mx = p.x
        resultP = p
      }
    }
    return resultP
  }, [restPoints])

  const targetX = useDerivedValue(() => {
    const to = x.value
    return withTiming(to, {
      duration: isActive ? 80 : 250,
      easing: isActive ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
    })
  }, [isActive, restP])

  const rectX = useDerivedValue(() => targetX.value - 1)

  const guideTop = top
  const guideHeight = Math.max(0, bottom - guideTop)

  const formatDateValue = useMemo(() => {
    return (v: InputFieldType) => {
      const dateVal = v ?? (restP?.xValue as string)
      const dateLabel = new Date(dateVal).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      setXValueText(dateLabel)
    }
  }, [setXValueText, restP?.xValue])

  useAnimatedReaction(
    () => ({ x: xValue.value, rest: restP?.xValue ?? restP?.x ?? 0 }),
    ({ x, rest }) => {
      'worklet'
      scheduleOnRN(formatDateValue, isActive ? x : rest)
    },
    [xValue, isActive, restP]
  )

  const textWidth = font ? font.measureText(xValueText).width : 0
  const textHeight = getFontHeight(font)
  const { width: cardW, height: cardH, radius } = wrapContent(textWidth, textHeight, {})

  const cardX = useDerivedValue(
    () => Math.max(left, Math.min(rectX.value - cardW / 2, right - cardW)),
    [left, right, cardW]
  )
  const cardY = useDerivedValue(() => guideTop)
  const lineY = useDerivedValue(() => guideTop + cardH)

  const textY = useDerivedValue(
    () => cardY.value + cardH - textHeight / 2,
    [cardY, cardH, textHeight]
  )
  const textX = useDerivedValue(
    () => cardX.value + cardW / 2 - textWidth / 2,
    [cardX, cardW, textWidth]
  )

  return (
    <>
      <>
        <Rect
          x={rectX}
          y={lineY}
          width={1}
          height={guideHeight}
          color={Colors.rgba(Colors.$outlineNeutral, 0.5)}
        />
        {showLabel && (
          <>
            <RoundedRect
              x={cardX}
              y={cardY}
              width={cardW}
              height={cardH}
              r={radius}
              color={Colors.$outlineNeutral}
            />
            <Text text={xValueText} x={textX} y={textY} font={font} color="white" />
          </>
        )}
      </>

      {seriesKeys.map((key, i) => {
        const seriesColor = colors?.[i] ?? color
        const denormFormatValue = valueDenorm
          ? (n: number) => fmtCardValue(valueDenorm(n))
          : undefined
        const rawOverride = restPoints[key]?.yValue ?? (restPoints[key]?.y as number)
        const resolvedOverride = valueDenorm ? valueDenorm(rawOverride ?? 0) : rawOverride
        return (
          <Fragment key={key}>
            <PointValueCard
              isActive={seriesIsActive}
              cx={targetX}
              label={key.replace(/_price$/, '')}
              cy={yKeys[key].position}
              valueSV={yKeys[key].value}
              formatValue={denormFormatValue}
              canvasTop={top}
              canvasBottom={bottom}
              restPoint={restPoints[key]}
              valueOverride={resolvedOverride}
              textColor={seriesColor as string | undefined}
              adjustedPositions={adjustedPositions}
              seriesIndex={i}
            />
          </Fragment>
        )
      })}
    </>
  )
}

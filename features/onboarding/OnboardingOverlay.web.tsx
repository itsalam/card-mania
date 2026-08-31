import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useOnboardingStore } from './OnboardingProvider'
import { TOURS } from './steps'
import { OnboardingStep, TargetMeasurement } from './types'

const PANEL_HEIGHT = 168
const PANEL_MARGIN = 16
const SCREEN_PADDING = 16

// Pure-JS path builder — same as native but used with DOM <svg>
function buildCutoutPath(W: number, H: number, m: TargetMeasurement, radius = 10): string {
  const { x, y, width, height } = m
  const r = Math.min(radius, width / 2, height / 2)
  const outer = `M 0 0 H ${W} V ${H} H 0 Z`
  const inner = [
    `M ${x + r} ${y}`,
    `H ${x + width - r}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
    `H ${x + r}`,
    `Q ${x} ${y + height} ${x} ${y + height - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `Z`,
  ].join(' ')
  return `${outer} ${inner}`
}

/** Expands a measured target by `padding` on every side for the spotlight highlight only —
 *  the target's own layout/component is never touched. */
function inflateMeasurement(m: TargetMeasurement, padding = 0): TargetMeasurement {
  if (!padding) return m
  return {
    x: m.x - padding,
    y: m.y - padding,
    width: m.width + padding * 2,
    height: m.height + padding * 2,
  }
}

// panelHeight defaults to PANEL_HEIGHT (a first-render guess, corrected once the panel measures
// its own actual height via onLayout — see SpotlightPanel) rather than a fixed constant: content
// height varies per step, and an undersized guess for an 'above'-positioned panel means its real
// (taller) bottom edge overlaps the target it's meant to sit above.
function getPanelTop(
  m: TargetMeasurement | undefined,
  step: OnboardingStep,
  screenH: number,
  panelHeight: number = PANEL_HEIGHT
): number {
  if (!m) return screenH / 2 - panelHeight / 2
  const spaceBelow = screenH - m.y - m.height
  const placeBelow =
    step.panelPosition === 'above'
      ? false
      : step.panelPosition === 'below'
        ? true
        : spaceBelow >= panelHeight + PANEL_MARGIN
  return placeBelow ? m.y + m.height + PANEL_MARGIN : m.y - panelHeight - PANEL_MARGIN
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
            { backgroundColor: i === current ? Colors.$textPrimary : Colors.$outlineDefault },
          ]}
        />
      ))}
    </View>
  )
}

function SpotlightPanel({
  step,
  measurement,
  currentIndex,
  totalSteps,
  screenH,
  canGoBack,
  onNext,
  onBack,
  onSkip,
}: {
  step: OnboardingStep
  measurement: TargetMeasurement | undefined
  currentIndex: number
  totalSteps: number
  screenH: number
  canGoBack: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const [measuredHeight, setMeasuredHeight] = useState(PANEL_HEIGHT)
  useEffect(() => {
    setMeasuredHeight(PANEL_HEIGHT)
  }, [step.id])

  const panelTop = getPanelTop(measurement, step, screenH, measuredHeight)
  const isLast = currentIndex === totalSteps - 1

  return (
    <View
      key={currentIndex}
      onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
      style={[
        styles.panel,
        {
          backgroundColor: Colors.$backgroundDefault,
          top: panelTop,
          left: SCREEN_PADDING,
          right: SCREEN_PADDING,
          opacity: 1,
          // CSS entry animation
        } as any,
      ]}
    >
      <Text style={[styles.panelTitle, { color: Colors.$textDefault }]}>{step.title}</Text>
      <Text style={[styles.panelDescription, { color: Colors.$textNeutral }]}>
        {step.description}
      </Text>
      {step.advanceByAction && (
        <Text style={[styles.panelHint, { color: Colors.$textNeutral }]}>
          {step.actionHint ?? 'Tap the highlighted button to continue'}
        </Text>
      )}
      <StepDots total={totalSteps} current={currentIndex} />
      <View style={styles.buttonRow}>
        {canGoBack && (
          <Pressable
            onPress={onBack}
            style={[styles.btnSecondary, { borderColor: Colors.$outlineDefault }]}
          >
            <Text style={[styles.btnSecondaryText, { color: Colors.$textDefault }]}>Back</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onSkip}
          style={[styles.btnSecondary, { borderColor: Colors.$outlineDefault }]}
        >
          <Text style={[styles.btnSecondaryText, { color: Colors.$textDefault }]}>Skip</Text>
        </Pressable>
        {/* advanceByAction steps only move forward via the real action on the highlighted
            element — see the matching comment in OnboardingOverlay.tsx. */}
        {!step.advanceByAction && (
          <Pressable
            onPress={onNext}
            style={[styles.btnPrimary, { backgroundColor: Colors.$backgroundPrimaryHeavy }]}
          >
            <Text style={[styles.btnPrimaryText, { color: Colors.$textDefault }]}>
              {isLast ? 'Done' : 'Next'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function OnboardingOverlayContent({ mounted }: { mounted: boolean }) {
  const active = useOnboardingStore((s) => s.active)
  const tourId = useOnboardingStore((s) => s.tourId)
  const currentIndex = useOnboardingStore((s) => s.currentIndex)
  const measurements = useOnboardingStore((s) => s.measurements)
  const registry = useOnboardingStore((s) => s._registry)
  const { next, back, skip } = useOnboardingStore()
  const { width: screenW, height: screenH } = useWindowDimensions()
  const [opacity, setOpacity] = useState(0)
  const steps = TOURS[tourId]

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => setOpacity(1))
    } else {
      setOpacity(0)
    }
  }, [active])

  // Pulse opacity on step change
  useEffect(() => {
    if (!active) return
    setOpacity(0.4)
    const t = setTimeout(() => setOpacity(1), 120)
    return () => clearTimeout(t)
  }, [currentIndex])

  if (!mounted) return null

  const step = steps[currentIndex]
  const rawMeasurement = step ? measurements[step.id] : undefined
  const measurement = rawMeasurement
    ? inflateMeasurement(rawMeasurement, step?.spotlightPadding)
    : undefined
  const canGoBack = currentIndex > 0 && registry.has(steps[currentIndex - 1].id)

  return (
    <View
      style={
        {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          opacity,
          transition: 'opacity 0.25s ease',
        } as any
      }
      pointerEvents="box-none"
    >
      {/* Backdrop with cutout */}
      {measurement
        ? React.createElement(
            'svg',
            {
              width: screenW,
              height: screenH,
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
              },
            } as any,
            React.createElement('path', {
              key: currentIndex,
              d: buildCutoutPath(screenW, screenH, measurement),
              fill: Colors.rgba(Colors.$backgroundDefault, 0.72),
              fillRule: 'evenodd',
            } as any)
          )
        : // No measurement yet — full dim
          React.createElement('div', {
            style: {
              position: 'absolute',
              inset: 0,
              backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.72),
              pointerEvents: 'none',
            },
          } as any)}

      {/* Spotlight border ring */}
      {measurement && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: measurement.x - 4,
            top: measurement.y - 4,
            width: measurement.width + 8,
            height: measurement.height + 8,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: Colors.rgba(Colors.$textDefault, 0.3),
          }}
        />
      )}

      {step && (
        <SpotlightPanel
          step={step}
          measurement={measurement}
          currentIndex={currentIndex}
          totalSteps={steps.length}
          screenH={screenH}
          canGoBack={canGoBack}
          onNext={next}
          onBack={back}
          onSkip={skip}
        />
      )}
      {!measurement && (
        <Pressable
          onPress={skip}
          style={[
            styles.btnSecondary,
            {
              position: 'absolute',
              top: 60,
              right: SCREEN_PADDING,
              borderColor: Colors.$outlineDefault,
              backgroundColor: Colors.$backgroundDefault,
            } as any,
          ]}
        >
          <Text style={[styles.btnSecondaryText, { color: Colors.$textDefault }]}>Skip</Text>
        </Pressable>
      )}
    </View>
  )
}

export function OnboardingOverlay() {
  const active = useOnboardingStore((s) => s.active)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (active) {
      setMounted(true)
    } else {
      const t = setTimeout(() => setMounted(false), 280)
      return () => clearTimeout(t)
    }
  }, [active])

  if (!mounted) return null
  return <OnboardingOverlayContent mounted={mounted} />
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  panelDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  panelHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
    borderRadius: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  btnPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnPrimaryText: {
    fontWeight: '600',
    fontSize: 14,
  },
  btnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 14,
  },
})

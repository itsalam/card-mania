import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useOnboardingStore } from './OnboardingProvider'
import { ONBOARDING_STEPS } from './steps'
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

function getPanelTop(
  m: TargetMeasurement | undefined,
  step: OnboardingStep,
  screenH: number
): number {
  if (!m) return screenH / 2 - PANEL_HEIGHT / 2
  const spaceBelow = screenH - m.y - m.height
  const placeBelow =
    step.panelPosition === 'above'
      ? false
      : step.panelPosition === 'below'
        ? true
        : spaceBelow >= PANEL_HEIGHT + PANEL_MARGIN
  return placeBelow ? m.y + m.height + PANEL_MARGIN : m.y - PANEL_HEIGHT - PANEL_MARGIN
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
  screenH,
  onNext,
  onBack,
  onSkip,
}: {
  step: OnboardingStep
  measurement: TargetMeasurement | undefined
  currentIndex: number
  screenH: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const panelTop = getPanelTop(measurement, step, screenH)
  const isLast = currentIndex === ONBOARDING_STEPS.length - 1

  return (
    <View
      key={currentIndex}
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
      <StepDots total={ONBOARDING_STEPS.length} current={currentIndex} />
      <View style={styles.buttonRow}>
        {currentIndex > 0 && (
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
        <Pressable
          onPress={onNext}
          style={[styles.btnPrimary, { backgroundColor: Colors.$backgroundPrimaryHeavy }]}
        >
          <Text style={[styles.btnPrimaryText, { color: '#fff' }]}>{isLast ? 'Done' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function OnboardingOverlayContent() {
  const active = useOnboardingStore((s) => s.active)
  const currentIndex = useOnboardingStore((s) => s.currentIndex)
  const measurements = useOnboardingStore((s) => s.measurements)
  const { next, back, skip } = useOnboardingStore()
  const { width: screenW, height: screenH } = useWindowDimensions()
  const [opacity, setOpacity] = useState(0)

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

  if (!active) return null

  const step = ONBOARDING_STEPS[currentIndex]
  const measurement = step ? measurements[step.id] : undefined

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
              fill: 'rgba(0,0,0,0.72)',
              fillRule: 'evenodd',
            } as any)
          )
        : // No measurement yet — full dim
          React.createElement('div', {
            style: {
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.72)',
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
            borderColor: 'rgba(255,255,255,0.3)',
          }}
        />
      )}

      {step && (
        <SpotlightPanel
          step={step}
          measurement={measurement}
          currentIndex={currentIndex}
          screenH={screenH}
          onNext={next}
          onBack={back}
          onSkip={skip}
        />
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
  return <OnboardingOverlayContent />
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

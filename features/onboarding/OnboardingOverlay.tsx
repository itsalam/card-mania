import React, { useEffect, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { FullWindowOverlay } from 'react-native-screens'
import { ClipPath, Defs, Path, Rect, Svg } from 'react-native-svg'
import { Colors } from 'react-native-ui-lib'
import { useOnboardingStore } from './OnboardingProvider'
import { TOURS } from './steps'
import { OnboardingStep, TargetMeasurement } from './types'

const PANEL_HEIGHT = 160
const PANEL_MARGIN = 20
const SCREEN_PADDING = 16

function buildCutoutPath(W: number, H: number, m: TargetMeasurement, radius = 8): string {
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

// panelHeight defaults to PANEL_HEIGHT (a guess used for the very first render, before the panel
// has measured its own actual height via onLayout — see SpotlightPanel) rather than a fixed
// constant throughout: content length varies per step (a step.description this long, or the
// advanceByAction hint, easily exceeds 160px), and 'above'-positioned panels anchor their *top*
// to `m.y - panelHeight - margin` — an undersized guess there means the panel's real (taller)
// bottom edge extends past that budget and overlaps the very target it's supposed to sit above.
function getPanelTop(
  m: TargetMeasurement,
  step: OnboardingStep,
  screenH: number,
  panelHeight: number = PANEL_HEIGHT
): number {
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
  measurement: TargetMeasurement
  currentIndex: number
  totalSteps: number
  screenH: number
  canGoBack: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  // PANEL_HEIGHT is only a first-render guess — content height varies per step (description
  // length, the advanceByAction hint), and an undersized guess for an 'above'-positioned panel
  // means its real (taller) bottom edge overlaps the target it's meant to sit above. onLayout
  // below corrects this to the panel's actual measured height once it's rendered.
  const [measuredHeight, setMeasuredHeight] = useState(PANEL_HEIGHT)
  useEffect(() => {
    setMeasuredHeight(PANEL_HEIGHT)
  }, [step.id])

  const panelTop = getPanelTop(measurement, step, screenH, measuredHeight)
  const isLast = currentIndex === totalSteps - 1

  return (
    <Animated.View
      key={currentIndex}
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(150)}
      onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
      style={[
        styles.panel,
        {
          backgroundColor: Colors.$backgroundDefault,
          top: panelTop,
          left: SCREEN_PADDING,
          right: SCREEN_PADDING,
        },
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
            element (see advanceIfCurrentStep) — showing a working-looking Next here would let
            the user skip past that action onto a step whose target was never navigated to,
            stranding the tour on the "waiting for measurement" dim fallback. */}
        {!step.advanceByAction && (
          <Pressable
            onPress={onNext}
            style={[styles.btnPrimary, { backgroundColor: Colors.$backgroundPrimaryHeavy }]}
          >
            <Text style={[styles.btnPrimaryText, { color: Colors.$textDefaultLight }]}>
              {isLast ? 'Done' : 'Next'}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
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
  const steps = TOURS[tourId]

  const overlayOpacity = useSharedValue(0)
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }))

  useEffect(() => {
    if (active) {
      overlayOpacity.value = withTiming(1, { duration: 300 })
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 })
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    overlayOpacity.value = withSequence(
      withTiming(0.3, { duration: 100 }),
      withTiming(1, { duration: 200 })
    )
  }, [currentIndex])

  if (!mounted) return null

  const step = steps[currentIndex]
  const rawMeasurement = step ? measurements[step.id] : undefined
  const measurement = rawMeasurement
    ? inflateMeasurement(rawMeasurement, step?.spotlightPadding)
    : undefined
  // Only offer Back if the previous step's target is actually mounted right now — for the
  // Collections guided tour, steps 2-4 are reached via real screen navigation (see
  // COLLECTION_TOUR_STEPS' comment in steps.ts), so the previous step's screen may no longer be
  // mounted, and Back would land on the same "waiting for measurement" dead end the orphaned
  // collection-graphs step used to hit.
  const canGoBack = currentIndex > 0 && registry.has(steps[currentIndex - 1].id)

  return (
    <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="box-none">
      {measurement ? (
        <>
          <Svg
            width={screenW}
            height={screenH}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Defs>
              <ClipPath id="spotlight-hole">
                <Path fillRule="evenodd" d={buildCutoutPath(screenW, screenH, measurement)} />
              </ClipPath>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={screenW}
              height={screenH}
              fill="rgba(0,0,0,0.75)"
              clipPath="url(#spotlight-hole)"
            />
          </Svg>

          {/* spotlight border ring */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: measurement.x - 3,
              top: measurement.y - 3,
              width: measurement.width + 6,
              height: measurement.height + 6,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: Colors.rgba(Colors.$textDefault, 0.35),
            }}
          />

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
        </>
      ) : (
        // Waiting for measurement — full dim, plus a Skip escape hatch. The Collections guided
        // tour's steps live behind real navigation (create a collection, open it) — if the user
        // abandons that flow instead of completing it, this target never mounts and the tour
        // would otherwise be stuck here with no way out.
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: Colors.rgba(Colors.$backgroundDark, 0.75) },
          ]}
          pointerEvents="box-none"
        >
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
              },
            ]}
          >
            <Text style={[styles.btnSecondaryText, { color: Colors.$textDefault }]}>Skip</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  )
}

export function OnboardingOverlay() {
  const active = useOnboardingStore((s) => s.active)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (active) {
      setMounted(true)
    } else {
      // Keep mounted briefly so the 200ms fade-out animation can finish
      const t = setTimeout(() => setMounted(false), 250)
      return () => clearTimeout(t)
    }
  }, [active])

  if (!mounted) return null

  const content = <OnboardingOverlayContent mounted={mounted} />

  if (Platform.OS === 'ios') {
    return <FullWindowOverlay>{content}</FullWindowOverlay>
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => useOnboardingStore.getState().skip()}
    >
      {content}
    </Modal>
  )
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
    fontSize: 18,
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

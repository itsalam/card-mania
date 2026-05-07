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
import { ONBOARDING_STEPS } from './steps'
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

function getPanelTop(m: TargetMeasurement, step: OnboardingStep, screenH: number): number {
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
  measurement: TargetMeasurement
  currentIndex: number
  screenH: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const panelTop = getPanelTop(measurement, step, screenH)
  const isLast = currentIndex === ONBOARDING_STEPS.length - 1

  return (
    <Animated.View
      key={currentIndex}
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(150)}
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
          <Text style={[styles.btnPrimaryText, { color: Colors.$textDefaultLight }]}>
            {isLast ? 'Done' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

function OnboardingOverlayContent() {
  const active = useOnboardingStore((s) => s.active)
  const currentIndex = useOnboardingStore((s) => s.currentIndex)
  const measurements = useOnboardingStore((s) => s.measurements)
  const { next, back, skip } = useOnboardingStore()
  const { width: screenW, height: screenH } = useWindowDimensions()

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

  if (!active) return null

  const step = ONBOARDING_STEPS[currentIndex]
  const measurement = step ? measurements[step.id] : undefined

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
              borderColor: 'rgba(255,255,255,0.35)',
            }}
          />

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
        </>
      ) : (
        // Waiting for measurement — show full dim
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.75)' }]}
          pointerEvents="none"
        />
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

  const content = <OnboardingOverlayContent />

  if (Platform.OS === 'ios') {
    return <FullWindowOverlay>{content}</FullWindowOverlay>
  }

  return (
    <Modal
      visible={active}
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

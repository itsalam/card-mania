import React, { useEffect, useRef } from 'react'
import { StyleProp, View, ViewStyle, useWindowDimensions } from 'react-native'
import { ONBOARDING_STEPS } from './steps'
import { OnboardingStepId } from './types'
import { useOnboardingStore } from './OnboardingProvider'

type Props = {
  id: OnboardingStepId
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function OnboardingTarget({ id, children, style }: Props) {
  const ref = useRef<View>(null)
  const { registerTarget, unregisterTarget, setMeasurement, active, currentIndex } =
    useOnboardingStore()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()

  useEffect(() => {
    registerTarget(id, ref)
    return () => unregisterTarget(id)
  }, [id])

  useEffect(() => {
    if (!active) return
    const currentStep = ONBOARDING_STEPS[currentIndex]
    if (currentStep?.id !== id) return

    const measure = () => {
      const node = ref.current as any
      if (!node?.measureInWindow) return
      node.measureInWindow((x: number, y: number, width: number, height: number) => {
        if (width > 0 && height > 0) {
          setMeasurement(id, { x, y, width, height })
        }
      })
    }

    requestAnimationFrame(measure)
  }, [active, currentIndex, id, screenWidth, screenHeight])

  return (
    <View ref={ref} style={style} collapsable={false}>
      {children}
    </View>
  )
}

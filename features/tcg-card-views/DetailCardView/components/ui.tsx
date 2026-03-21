import { MeasuredLayout } from '@/components/hooks/useMeasure'
import React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { AnimatedStyle, SharedValue } from 'react-native-reanimated'
import { Assets } from 'react-native-ui-lib'

import { Eye, EyeOff, SearchX } from 'lucide-react-native'

// helper: pick nearest snap, biased by release velocity
export function snapPoint(y: number, velocityY: number, snapPoints: number[]) {
  'worklet'
  // project the end position a bit in the velocity direction
  const projected = y + 0.2 * velocityY // 200ms of momentum
  let closest = snapPoints[0]
  let dist = Math.abs(projected - closest)
  for (let i = 1; i < snapPoints.length; i++) {
    const d = Math.abs(projected - snapPoints[i])
    if (d < dist) {
      dist = d
      closest = snapPoints[i]
    }
  }
  return closest
}

export type ThumbProps = {
  /** Y (in px) where the card should lock (lower is higher on screen). Ex: 120 */
  lockY?: number
  /** bottom (rest) position of the card */
  restY?: number
  /** optional: additional snap points, e.g., half step */
  extraSnapPoints?: number[]
  /** called when we snap into/out of the lock */
  onLockedChange?: (locked: boolean) => void
  toggleLocked?: boolean
  children: React.ReactNode
  style?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
  mainContentBreakpoint?: SharedValue<number>
  mainContent?: React.ReactNode
  onMainContentMeasure?: (ml?: MeasuredLayout) => void
  isKeyboardAccessory?: boolean
  containerStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
  absoluteThumb?: boolean
}

export const THUMB_SIZE = 5
export const THUMB_PADDING = 8

export const VISIBILITY_OPTIONS = [
  {
    key: 'private' as const,
    icon: EyeOff,
    label: 'Private',
    description: 'Only you can see this collection.',
    iconSource: Assets.lucide['eye-off'],
  },
  {
    key: 'public' as const,
    icon: Eye,
    label: 'Public',
    description: 'Anyone can see this collection.',
    iconSource: Assets.lucide.eye,
  },
  {
    key: 'unlisted' as const,
    icon: SearchX,
    label: 'Unlisted',
    description: 'Only people with the link can see this collection.',
    iconSource: Assets.lucide['search-x'],
  },
] as const

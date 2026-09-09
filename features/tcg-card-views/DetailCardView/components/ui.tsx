import { MeasuredLayout } from '@/components/hooks/useMeasure'
import { ShoulderCutoutDescriptor } from '@/components/Background'
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
  reverseExpand?: boolean
  /** Threaded straight to the sheet's BlurGradientBackground — cuts a matching void behind an
   *  AppStandaloneHeader shoulder-cutout pill rendered inside mainContent/children. Pass
   *  undefined when no cutout pill is currently shown (e.g. a different page) so the
   *  background renders as a plain rect rather than leaving a stale notch. */
  shoulderCutout?: ShoulderCutoutDescriptor
  /** When true, the reverseExpand pinned bar animates to visually read as "the same container as
   *  the sheet" once it opens above the bar: a fading-in background (transparent → a translucent
   *  fill matching the sheet's own blur opacity), a top border + radius identical to the sheet's
   *  own corner, and a little extra bottom padding so content doesn't sit flush against the
   *  newly-appeared border. Flush/transparent/borderless while collapsed. Defaults to false —
   *  this bar has more than one reverseExpand consumer (e.g. SearchScreen.tsx's filters bar),
   *  and not all of them want this look, so it's opt-in per caller. See footer.tsx. */
  pinnedBarMatchesSheet?: boolean
  /** Caps the fully-revealed sheet at this fraction of the window's visible height (e.g. 0.6 =
   *  60%) — applied as a `maxHeight` on the sheet's own blurred background, so content taller
   *  than the cap is clipped/scrollable within it rather than growing the reveal past it, and
   *  the flex chain feeding the sheet's content (see detailContainer in DraggableFooter) gets a
   *  real bounded height to fill instead of an unbounded/intrinsic one. Defaults to 0.6 for every
   *  caller — override only for a screen that deliberately wants a taller or shorter cap. */
  maxSheetHeightRatio?: number
  /** Slides the sheet (and, in reverseExpand, the pinned bar too — same motion, same spring) up
   *  from ENTRANCE_OFFSET px below its resting position once on mount, instead of it already
   *  sitting in place on first render. Defaults to false — opt-in per caller since most
   *  DraggableFooter consumers (e.g. SearchScreen.tsx) mount already "settled" and don't want an
   *  entrance animation. See footer.tsx for the one caller that does. */
  animateEntrance?: boolean
  /** Gates exactly when the animateEntrance spring actually starts — the mount effect that would
   *  fire it no-ops while this is false. Defaults to true (fire immediately on mount, the
   *  original animateEntrance behavior) — pass false-then-true to delay the entrance until some
   *  other in-progress animation starts (or finishes) first. See footer.tsx, which times this to
   *  the hero image's own entrance transition STARTING (CardDetailsStore's heroImageReady) so
   *  the two run concurrently rather than the footer waiting for the image to fully land. */
  entranceReady?: boolean
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

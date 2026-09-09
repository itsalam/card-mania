import { ThumbProps, snapPoint } from '@/features/tcg-card-views/DetailCardView/components/ui'
import React, { useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, View } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { BlurBackground, BlurGradientBackground } from './Background'
import { useMeasure } from './hooks/useMeasure'
import { SHEET_RADIUS, thumbStyles } from './ui/modal'

// Extra bottom padding the pinned bar grows once revealed-as-sheet (see pinnedBarMatchesSheet) —
// a little more breathing room once it reads as a bordered "shelf" rather than sitting flush
// against the screen edge.
const PINNED_BAR_REVEALED_EXTRA_PADDING = 8

// reverseExpand: height of the drag thumb revealed ABOVE the pinned bar when
// collapsed, so it stays visible and touchable for the pan gesture. The full
// collapsed peek = pinned bar height + this (the sheet's bottom barHeight sits
// behind the pinned bar). Tune to the thumb container's height.
const THUMB_PEEK = 24

// animateEntrance: extra downward displacement both the sheet and the pinned bar start at on
// mount, animating to 0 via the same shared mountProgress value below — so they slide up into
// place together, not just the sheet alone.
const ENTRANCE_OFFSET = 80

export default function DraggableFooter({
  onLockedChange,
  children,
  style,
  mainContent,
  toggleLocked,
  isKeyboardAccessory,
  containerStyle,
  onMainContentMeasure,
  absoluteThumb = false,
  reverseExpand = false,
  shoulderCutout,
  pinnedBarMatchesSheet = false,
  maxSheetHeightRatio = 0.6,
  animateEntrance = false,
  entranceReady = true,
}: ThumbProps) {
  const { progress: keyboardProgress, height: keyboardHeight } = useReanimatedKeyboardAnimation()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const maxSheetHeight = windowHeight * maxSheetHeightRatio
  const {
    ref: mainContentRef,
    layout: mainContentLayout,
    onLayout: onMainContentLayout,
  } = useMeasure<Animated.View>({ onMeasure: onMainContentMeasure })
  const {
    ref: fullContentRef,
    layout: fullContentLayout,
    onLayout: onFullContentLayout,
  } = useMeasure<Animated.View>()
  const extraSnapSV = useSharedValue<number[]>([]) // mirror prop into a shared value

  const restMain = useDerivedValue(
    () => Math.min(mainContentLayout?.height ?? 80, 80) + 12,
    [mainContentLayout?.height, insets]
  )
  // Full reveal distance. Normal mode subtracts the safe area (its content carries
  // a bottom inset pad). reverseExpand ADDS the pinned bar height so the reveal
  // lands the sheet's bottom edge exactly on the bar's top — everything above the
  // bar, nothing hidden behind it (reserved in the reveal, not via padding).
  // The sheet-content portion (not the added pinned-bar height) is capped at
  // maxSheetHeightRatio of the window — capping the SNAP TARGET here, rather than the
  // rendered content's actual height/maxHeight, deliberately leaves the content's own
  // intrinsic-size + paddingBottom:400 mechanism (BlurGradientBackground below) untouched;
  // content taller than the cap simply stays partially off-screen/clipped past the reveal
  // point, same as it already does past any snap point.
  const restFull = useDerivedValue(
    () =>
      Math.min(fullContentLayout?.height ?? 0, maxSheetHeight) +
      (reverseExpand ? (mainContentLayout?.height ?? 0) : -insets.bottom),
    // No separate pinnedBarMatchesSheet growth reserve here — mainContentLayout.height is
    // measured on the same Animated.View that carries the bar's own animated extra
    // padding/border (pinnedBarStyle below), so once that expand animation settles onLayout
    // fires again and mainContentLayout.height already reflects the grown size on its own.
    // Adding a separate fixed reserve on top of that double-counted it once settled — a small,
    // persistent overshoot rather than the one-off mid-animation gap it was meant to cover.
    [fullContentLayout?.height, mainContentLayout?.height, insets, reverseExpand, maxSheetHeight]
  )

  // Collapsed peek. In reverseExpand the bar is pinned separately; collapse so the
  // sheet's bottom barHeight tucks behind the pinned bar while the top THUMB_PEEK
  // (the drag thumb) still shows above it and stays grabbable.
  const restCollapsed = useDerivedValue(
    () => (reverseExpand ? (mainContentLayout?.height ?? 0) + THUMB_PEEK : restMain.value),
    [reverseExpand, mainContentLayout?.height]
  )

  const SNAP = useDerivedValue(() => {
    'worklet'
    const arr = [restCollapsed.value, restFull.value, ...extraSnapSV.value]
    // unique + sort (worklet-safe)
    const uniq: number[] = []
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]

      if (v !== undefined && !uniq.includes(v)) uniq.push(v)
    }
    uniq.sort((a, b) => a - b)
    return uniq
  })

  const toggleRevealedSV = useSharedValue<boolean | undefined>(undefined)
  const translateY = useSharedValue(restCollapsed.value)
  const startY = useSharedValue(restCollapsed.value)
  const isRevealed = useSharedValue(toggleLocked)
  // 0 → 1 once on mount when animateEntrance — drives both cardStyle's and pinnedBarStyle's own
  // extra translateY term (ENTRANCE_OFFSET → 0) below, so the sheet and the pinned bar slide up
  // together using the exact same spring rather than two separately-timed animations. Starts
  // already at 1 (no-op) when animateEntrance is off, so every other DraggableFooter consumer
  // (e.g. SearchScreen.tsx) is unaffected by default.
  const mountProgress = useSharedValue(animateEntrance ? 0 : 1)

  useEffect(() => {
    toggleRevealedSV.value = toggleLocked
  }, [toggleLocked])

  useEffect(() => {
    // entranceReady (default true) lets a caller hold this off until some other in-progress
    // animation lands first (e.g. footer.tsx delays this until the hero image's own
    // animateFrom→animateTo transition finishes) rather than firing the instant this mounts.
    if (!animateEntrance || !entranceReady) return
    // panel-entry preset (see CLAUDE.md's spring presets table) — "cards, sheets, or panels
    // animating into position".
    mountProgress.value = withSpring(1, { damping: 20, stiffness: 260, mass: 0.9 })
  }, [animateEntrance, entranceReady, mountProgress])

  // assume SNAP is a derived shared value: const SNAP = useDerivedValue<number[]>(...)
  // Optional: keep a derived "targetY" so you can observe a single number change
  const targetY = useDerivedValue<number>(() => {
    const arr = SNAP.value
    if (!arr.length) return 0 // fallback
    return toggleRevealedSV.value ? arr[arr.length - 1] : arr[0]
  })

  useAnimatedReaction(
    () => targetY.value,
    (to) => {
      // isLocked bookkeeping
      const next = toggleRevealedSV.value ?? false
      if (isRevealed.value !== next) {
        isRevealed.value = next
        onLockedChange && scheduleOnRN(onLockedChange, next)
      }
      translateY.value = withSpring(to, { damping: 100, stiffness: 300 })
    }
  )

  useAnimatedReaction(
    () => restCollapsed.value, // watch the derived collapsed peek
    (curr) => {
      // keep the sheet resting at the collapsed peek until revealed
      if (!(toggleRevealedSV.value ?? false)) {
        translateY.value = curr
      }
    }
  )

  // Factory, not a single shared instance — RNGH doesn't allow the same Gesture instance to be
  // attached to more than one GestureDetector at once, and this drag now arms from two separate
  // detectors simultaneously: the sheet's own thumb, and (reverseExpand) the pinned bar itself
  // (see pinnedBarComposed below). Both instances share the exact same worklet logic/closed-over
  // shared values, so they behave identically — just as distinct gesture objects.
  const makeDragPan = () =>
    Gesture.Pan()
      .onBegin(() => {
        startY.value = translateY.value
      })
      .onChange((e) => {
        // positive e.translationY is downward
        const next = startY.value - e.translationY
        const points = SNAP.value
        if (!points.length) return
        // clamp between collapsed peek and the last (full) snap point
        const last = points[points.length - 1]
        translateY.value = Math.min(Math.max(next, restCollapsed.value), last)
      })
      .onEnd((e) => {
        const points = SNAP.value
        if (!points.length) return

        // velocityY is already positive when moving down
        const to = snapPoint(translateY.value, -e.velocityY, SNAP.value)

        const last = points[points.length - 1]
        const EPS = 0.5 // pixels; adjust to taste
        const nextLocked = Math.abs(to - last) <= EPS

        if (isRevealed.value !== nextLocked) {
          isRevealed.value = nextLocked
          onLockedChange && scheduleOnRN(onLockedChange, nextLocked)
        }
        translateY.value = withSpring(to, { damping: 100, stiffness: 300 })
      })

  const composed = Gesture.Simultaneous(makeDragPan())
  const pinnedBarComposed = Gesture.Simultaneous(makeDragPan())

  // Keyboard offset shared by the sheet and the pinned bar so they stay aligned.
  const keyboardOffset = useDerivedValue(() =>
    isKeyboardAccessory ? interpolate(keyboardProgress.value, [0, 1], [0, keyboardHeight.value]) : 0
  )

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          -translateY.value +
          keyboardOffset.value +
          interpolate(mountProgress.value, [0, 1], [ENTRANCE_OFFSET, 0]),
      },
    ],
  }))

  const fullOpacity = useDerivedValue(() => 1)

  const thumbStyle = useAnimatedStyle(() => ({
    // subtle feedback when “armed” near the lock
    opacity: translateY.value < SNAP.value[1] / 2 ? 0.9 : 0.2,
  }))

  const paddingBottom = useDerivedValue(
    () =>
      insets.bottom +
      (isKeyboardAccessory
        ? 0
        : interpolate(
            keyboardProgress.value,
            [0, 1],
            [0, -keyboardHeight.value + 20 - insets.bottom]
          )),
    [keyboardProgress, isKeyboardAccessory, keyboardHeight]
  )

  const mainContentBlurOpacity = useDerivedValue<number>(() =>
    withTiming(isRevealed.value ? 1 : 0, { duration: 250 })
  )

  // Colors.$xxx is a getter on a react-native-ui-lib proxy object, not a plain value — reading
  // it directly inside a worklet throws ("cannot be sent to the UI runtime"). Resolve both to
  // plain strings on the JS thread and close over those instead. backgroundOpacity 0.95 matches
  // the sheet's own BlurGradientBackground backgroundOpacity below, for a consistent "same
  // container" read once the pinned bar is fully revealed.
  const sheetLikeBackgroundColor = Colors.rgba(Colors.$backgroundDefault, 0.95) ?? 'transparent'
  const sheetLikeBorderColor = Colors.$outlineNeutral

  // Pinned bar (reverseExpand): only the keyboard offset drives its position unconditionally.
  // pinnedBarMatchesSheet additionally animates this bar to visually read as "the same container
  // as the sheet" once revealed: a fading-in background (transparent → sheetLikeBackgroundColor),
  // a top border + radius identical to the sheet's own corner (SHEET_RADIUS), and — since padding
  // has to grow in step with the same reveal to avoid content sitting flush against the
  // newly-appeared border — a bit of extra bottom padding (applied below, on the BlurBackground
  // child, alongside the base insets.bottom every pinned bar already carries). Opt-in per caller
  // (default false) since this bar has more than one consumer — SearchScreen.tsx's filters bar
  // doesn't want this look.
  const pinnedBarStyle = useAnimatedStyle(() => ({
    // Same mountProgress-driven extra term as cardStyle, so this bar slides up in lockstep with
    // the sheet on mount instead of already sitting in place while the sheet animates in alone.
    transform: [
      {
        translateY:
          keyboardOffset.value + interpolate(mountProgress.value, [0, 1], [ENTRANCE_OFFSET, 0]),
      },
    ],
    // Padding lives here (on this Animated.View), not on the plain-View BlurBackground below —
    // a useAnimatedStyle result only actually animates on a real Animated component.
    paddingBottom:
      insets.bottom +
      (pinnedBarMatchesSheet
        ? mainContentBlurOpacity.value * PINNED_BAR_REVEALED_EXTRA_PADDING
        : 0),
    ...(pinnedBarMatchesSheet
      ? {
          backgroundColor: interpolateColor(
            mainContentBlurOpacity.value,
            [0, 1],
            ['transparent', sheetLikeBackgroundColor]
          ),
          borderColor: sheetLikeBorderColor,
          // borderWidth (all 4 sides), not borderTopWidth — the sheet itself (thumbStyles.sheet)
          // is bordered on every side too, just with only its top two corners rounded; a
          // top-only border here left the left/right edges with no stroke at all.
          borderWidth: mainContentBlurOpacity.value,
          borderTopLeftRadius: mainContentBlurOpacity.value * SHEET_RADIUS,
          borderTopRightRadius: mainContentBlurOpacity.value * SHEET_RADIUS,
        }
      : {}),
  }))

  // Clipping lives on a SEPARATE inner wrapper from the border above, deliberately — mirroring
  // thumbStyles.sheet (border, unclipped) vs. sheetInner (overflow:hidden, no border) below.
  // The bar's content includes a BlurBackground (a native BlurView), and on Android that native
  // blur surface can composite ABOVE the ancestor view's own border paint when overflow:'hidden'
  // and the border live on the very same view — the border silently disappears once the blur is
  // actually visible (i.e. once expanded). Keeping the border on the unclipped outer
  // Animated.View and clipping only this inner wrapper avoids the two ever sharing a layer.
  const pinnedBarClipStyle = useAnimatedStyle(() => ({
    borderTopLeftRadius: pinnedBarMatchesSheet ? mainContentBlurOpacity.value * SHEET_RADIUS : 0,
    borderTopRightRadius: pinnedBarMatchesSheet ? mainContentBlurOpacity.value * SHEET_RADIUS : 0,
  }))

  const detailContentStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(isRevealed.value ? 1 : 0, { duration: 250 }),
      // reverseExpand pads the bottom by the pinned bar height (below) via a plain
      // style; normal mode uses the keyboard-aware paddingBottom here.
      ...(reverseExpand ? {} : { paddingBottom: 0 }),
    }),
    [paddingBottom, reverseExpand]
  )

  const thumbContainer = (
    <Animated.View
      style={[
        thumbStyles.thumbContainer,
        absoluteThumb ? thumbStyles.absoluteThumbContainer : null,
      ]}
    >
      <Animated.View
        style={[
          thumbStyles.thumb,
          { backgroundColor: Colors.rgba(Colors.$backgroundNeutralIdle, 0.8) },
          thumbStyle,
        ]}
      />
    </Animated.View>
  )

  // Normal mode: mainContent lives inside the translated sheet.
  const mainContentContainer = (
    <Animated.View
      style={[thumbStyles.mainContent, { paddingBottom: insets.bottom }]}
      ref={mainContentRef}
      onLayout={onMainContentLayout}
    >
      {thumbContainer}
      {mainContent}
    </Animated.View>
  )

  const detailContainer = (
    <Animated.View
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        zIndex: 1,
      }}
    >
      {reverseExpand && <GestureDetector gesture={composed}>{thumbContainer}</GestureDetector>}
      <Animated.View
        style={[
          { alignSelf: 'stretch' },
          reverseExpand && thumbStyles.mainContent,
          detailContentStyle,
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  )

  const sheet = (
    <Animated.View
      style={[
        containerStyle,
        thumbStyles.sheet,
        {
          borderColor: Colors.$outlineNeutral,
        },
        cardStyle,
      ]}
      className="flex flex-col items-center"
      ref={fullContentRef}
    >
      <BlurGradientBackground
        style={[thumbStyles.sheetInner, { flex: 1, alignSelf: 'stretch', paddingBottom: 400 }]}
        backgroundOpacity={0.95}
        opacity={mainContentBlurOpacity}
        shoulderCutout={shoulderCutout}
      >
        <View
          // A DEFINITE height (not maxHeight) — this whole chain above (BlurGradientBackground's
          // paddingBottom:400 buffer, thumbStyles.sheet's own auto/intrinsic sizing) is
          // deliberately auto-height for the translateY reveal trick to work, which means Yoga
          // has no bounded main-axis size to distribute to flex:1 descendants: a flex:1 item
          // inside an auto-height ancestor is sized to its own (possibly ~0, since further-nested
          // flex:1 items collapse the same way) content first, THEN clamped — so maxHeight here
          // only capped an already-collapsed height, which is why the sheet stopped taking any
          // space. A definite `height` sidesteps that: it gives this View, and everything flexing
          // inside it (detailContainer -> children wrapper -> Swapper -> e.g.
          // AddToCollectionsView's ScrollView), a real fixed box to fill/scroll within, while the
          // auto-sized ancestors above it just treat this fixed box as ordinary (tall) content —
          // preserving the reveal buffer untouched.
          style={{ height: maxSheetHeight, alignSelf: 'stretch' }}
          onLayout={onFullContentLayout}
        >
          {reverseExpand ? (
            <BlurBackground
              style={[{ flex: 1, zIndex: 2, display: 'flex', minHeight: 52, alignSelf: 'stretch' }]}
            >
              {detailContainer}
            </BlurBackground>
          ) : (
            <>
              <GestureDetector gesture={composed}>
                <BlurBackground
                  style={[{ zIndex: 2, display: 'flex', minHeight: 52, alignSelf: 'stretch' }]}
                >
                  {mainContentContainer}
                </BlurBackground>
              </GestureDetector>
              {detailContainer}
            </>
          )}
        </View>
      </BlurGradientBackground>
    </Animated.View>
  )

  if (!reverseExpand) return sheet

  // reverseExpand: the detail sheet expands above a bar that is pinned to the
  // viewport bottom (moves only with the keyboard).
  const pinnedBar = (
    <Animated.View
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10 }, pinnedBarStyle]}
      ref={mainContentRef}
      onLayout={onMainContentLayout}
    >
      {/* Clips the blur content into the animated rounded top corners — see pinnedBarClipStyle's
          own comment for why this is a separate view from the border above rather than the same
          overflow:'hidden' view. */}
      <Animated.View style={[{ alignSelf: 'stretch', overflow: 'hidden' }, pinnedBarClipStyle]}>
        {/* Same `composed` gesture as the sheet's own thumb — panning up on the pinned bar itself
            (not just the thumb) also expands the footer. Gesture.Simultaneous lets it coexist
            with mainContent's own Pressables/TouchableOpacitys underneath (tapping an icon still
            just taps it); it only takes over once an actual vertical drag is detected. */}
        <GestureDetector gesture={pinnedBarComposed}>
          <BlurBackground style={{ alignSelf: 'stretch' }} opacity={fullOpacity}>
            {mainContent}
          </BlurBackground>
        </GestureDetector>
      </Animated.View>
    </Animated.View>
  )

  return (
    <>
      {sheet}
      {pinnedBar}
    </>
  )
}

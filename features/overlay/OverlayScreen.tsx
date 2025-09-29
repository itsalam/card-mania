// overlays/CoachmarkOverlay.tsx
import { BlurView } from 'expo-blur'
import React, { useMemo } from 'react'
import { Dimensions, Pressable, StyleSheet, View } from 'react-native'
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg'

export type Hole = { x: number; y: number; width: number; height: number; radius?: number }

export function OverlayScreen({
  holes,
  onDismiss,
  opacity = 0.0,
  content,
  passThroughAll = true, // set true to remove blockers entirely
}: {
  holes: Record<string, Hole>
  onDismiss?: () => void
  opacity?: number
  content?: React.ReactNode
  passThroughAll?: boolean
}) {
  const { width: W, height: H } = Dimensions.get('window')
  const holeList = Object.values(holes)

  // --- Visual mask with multiple holes
  const d = useMemo(() => {
    const outer = `M0 0 H${W} V${H} H0 V0 Z`
    const inner = holeList
      .map((h) => roundedRectPath(h.x, h.y, h.width, h.height, h.radius ?? 12))
      .join(' ')
    return `${outer} ${inner}`
  }, [holeList, W, H])

  const holePaths = useMemo(
    () =>
      holeList.map((h, i) => (
        <Path
          key={i}
          d={roundedRectPath(h.x, h.y, h.width, h.height, h.radius ?? 12)}
          fill="black" // black = "cut out" in mask
        />
      )),
    [holeList]
  )

  // --- Non-overlapping slabs that exclude ALL holes
  const slabs = useMemo(() => slabsExcludingHoles(holeList, W, H), [holeList, W, H])

  return (
    <>
      // If you want *zero* interception (no dismiss on outside), set pointerEvents="none" here.
      <View pointerEvents={'none'} style={StyleSheet.absoluteFill}>
        {/* Visual dim layer (never intercepts) */}
        <Svg style={StyleSheet.absoluteFill} width={W} height={H} pointerEvents="none">
          <Defs>
            <Mask id="holeMask">
              {/* White keeps opacity; black removes (transparent) */}
              <Rect x={0} y={0} width={W} height={H} fill="white" />
              {holePaths}
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="black"
            opacity={opacity}
            mask="url(#holeMask)"
          />
          {/* <Path d={d} fill={`rgba(0,0,0,${opacity})`} fillRule="evenodd" clipRule="evenodd" /> */}
        </Svg>

        {/* Any overlay UI; use box-none so holes remain touch-through */}
        {content ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {content}
          </View>
        ) : null}
      </View>
      {/* Outside blockers (never overlap holes) */}
      {slabs.map((s, i) => (
        <Pressable
          key={i}
          onPress={onDismiss}
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            width: s.width,
            height: s.height,
          }}
        >
          <BlurView intensity={10} style={{ flex: 1 }} />
        </Pressable>
      ))}
    </>
  )
}

/** Rounded-rect subpath for even-odd */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  return [
    `M${x + rr} ${y}`,
    `H${x + w - rr}`,
    `A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `V${y + h - rr}`,
    `A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `H${x + rr}`,
    `A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `V${y + rr}`,
    `A${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    'Z',
  ].join(' ')
}

/**
 * Build non-overlapping blocker rectangles that cover the screen EXCEPT the union of holes.
 * Algorithm:
 *  - Collect unique x and y cuts at 0, W, holes' x and x+width; 0, H, holes' y and y+height
 *  - Iterate grid cells; add a slab for any cell not inside any hole
 */
function slabsExcludingHoles(holes: Hole[], W: number, H: number) {
  // 1) Cuts
  const xs = Array.from(
    new Set([0, W, ...holes.flatMap((h) => [clamp(h.x, 0, W), clamp(h.x + h.width, 0, W)])])
  ).sort((a, b) => a - b)
  const ys = Array.from(
    new Set([0, H, ...holes.flatMap((h) => [clamp(h.y, 0, H), clamp(h.y + h.height, 0, H)])])
  ).sort((a, b) => a - b)

  // 2) Cells
  const out: { left: number; top: number; width: number; height: number }[] = []
  for (let yi = 0; yi < ys.length - 1; yi++) {
    for (let xi = 0; xi < xs.length - 1; xi++) {
      const left = xs[xi]
      const top = ys[yi]
      const width = xs[xi + 1] - left
      const height = ys[yi + 1] - top
      if (width <= 0 || height <= 0) continue

      // 3) Skip if this cell intersects ANY hole interior
      const cx = left + width / 2
      const cy = top + height / 2
      const insideAnyHole = holes.some((h) => pointInRect(cx, cy, h))
      if (!insideAnyHole) out.push({ left, top, width, height })
    }
  }
  return out
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function pointInRect(x: number, y: number, r: Hole) {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
}

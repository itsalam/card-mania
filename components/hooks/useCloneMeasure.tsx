import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'

type Layout = { x: number; y: number; width: number; height: number }

type UseCloneMeasureRNOpts = {
  deps?: any[]
  removeAfterMeasure?: boolean // default true
}

export function useCloneMeasure(
  element: React.ReactElement | null,
  opts: UseCloneMeasureRNOpts = {}
) {
  const { deps = [], removeAfterMeasure = true } = opts
  const [layout, setLayout] = useState<Layout | null>(null)
  const measured = useRef(false)

  const shouldRenderClone = !!element && !(removeAfterMeasure && layout && measured.current)

  useEffect(() => {
    measured.current = false
  }, [...deps])

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout
    measured.current = true
    setLayout({ x, y, width, height })
  }, [])

  const Clone = useMemo(() => {
    if (!shouldRenderClone || !element) return null

    return (
      <View style={styles.offscreen} onLayout={onLayout} pointerEvents="none">
        {element}
      </View>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRenderClone, element, onLayout, ...deps])

  const clear = () => setLayout(null)

  return { layout, Clone, clear }
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -100000,
    top: 0,
    opacity: 0,
  },
})

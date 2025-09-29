import React, { useCallback, useId, useRef } from 'react';
import { findNodeHandle, UIManager, View, ViewProps } from 'react-native';
import { useOverlayStore } from './provider';

type Props = ViewProps & { onMeasured?: (rect: { x: number; y: number; width: number; height: number }) => void }

export const Target = React.forwardRef<View, Props>(({ onMeasured, ...rest }, ref) => {
    const { addHole } = useOverlayStore()
    const innerRef = useRef<View>(null)
    const id = useId();

    const measure = useCallback(() => {
        const handle = findNodeHandle((ref as any)?.current ?? innerRef.current)
        if (!handle) return
        UIManager.measureInWindow(handle, (x, y, width, height) => {
            onMeasured?.({ x, y, width, height })
            addHole(id, { x, y, width, height })
        })
    }, [onMeasured, ref])

    // consumers can call measure() after layout/visibility changes if needed
    React.useEffect(() => {
        const id = requestAnimationFrame(measure)
        return () => cancelAnimationFrame(id)
    }, [measure])

    return <View ref={(node) => {
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as any).current = node
        innerRef.current = node
    }} onLayout={measure} {...rest} />
})
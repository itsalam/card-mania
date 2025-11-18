import { useCallback, useRef, useState } from "react";
import {
    findNodeHandle,
    LayoutChangeEvent,
    NativeMethods,
    ViewProps,
} from "react-native";

export type MeasuredLayout = {
    x: number;
    y: number;
    width: number;
    height: number;
    pageX: number; // absolute X on screen
    pageY: number; // absolute Y on screen
};

type Options = {
    /** If true, rounds numbers to integers to avoid sub-pixel flicker */
    round?: boolean;
    /** Optional external onLayout you still want to run */
    onLayout?: ViewProps["onLayout"];
    layoutOnce?: boolean;
};

type HasMeasure = Pick<NativeMethods, "measure">;

export function useMeasure<T extends HasMeasure>(opts: Options = {}) {
    const { round = false, onLayout: externalOnLayout, layoutOnce = true } =
        opts;

    const hasMeasured = useRef(false);
    const ref = useRef<T | null>(null);
    const [layout, setLayout] = useState<MeasuredLayout | null>(null);

    const setFromEvent = useCallback((e: LayoutChangeEvent) => {
        if (layoutOnce && hasMeasured.current) return;
        const { x, y, width, height } = e.nativeEvent.layout;
        setLayout((prev) => ({
            pageX: prev?.pageX ?? 0,
            pageY: prev?.pageY ?? 0,
            x: round ? Math.round(x) : x,
            y: round ? Math.round(y) : y,
            width: round ? Math.round(width) : width,
            height: round ? Math.round(height) : height,
        }));
        hasMeasured.current = true;
    }, [round]);

    const measureInWindow = useCallback(() => {
        if (layoutOnce && hasMeasured.current) return;
        if (!ref.current) return;
        //@ts-ignore
        const node = findNodeHandle(ref.current);
        if (!node) return;
        ref.current?.measure(
            (_x, _y, w, h, px, py) => {
                setLayout((prev) => {
                    const base = prev ??
                        {
                            x: 0,
                            y: 0,
                            width: w,
                            height: h,
                            pageX: px,
                            pageY: py,
                        };
                    const pageX = round ? Math.round(px) : px;
                    const pageY = round ? Math.round(py) : py;
                    const width = round ? Math.round(base.width) : base.width;
                    const height = round
                        ? Math.round(base.height)
                        : base.height;
                    return { ...base, pageX, pageY, width, height };
                });
                hasMeasured.current = true;
            },
        );
    }, [round]);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        // 1) keep any external handler working
        externalOnLayout?.(e);
        // 2) update local x,y,width,height
        setFromEvent(e);
        // 3) also compute absolute screen coords
        //    (schedule after layout to ensure correct position)
        requestAnimationFrame(measureInWindow);
    }, [externalOnLayout, setFromEvent, measureInWindow]);

    const remeasure = useCallback(() => {
        // Manually remeasure later (e.g., after animations or modal open)
        measureInWindow();
    }, [measureInWindow]);

    return { ref, layout, onLayout, remeasure };
}

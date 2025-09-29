import { useIsFocused } from "@react-navigation/native";
import { Href, router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Dimensions, View } from "react-native";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

export function measureInWindowAsync(
  ref: React.RefObject<View>,
): Promise<{ x: number; y: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const node = ref.current as any;
    if (!node?.measureInWindow) {
      return reject(new Error("measureInWindow missing"));
    }
    node.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        console.debug("measured:", { x, y, width, height });
        resolve({ x, y, width, height });
      },
    );
  });
}

function safeBack(fallback = "" as Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

function useSafeOnClose(onClose?: () => void, fallback?: Href) {
  const closing = useRef(false);
  return useCallback(() => {
    if (closing.current) return; // prevent double-pop / double-call
    closing.current = true;
    try {
      onClose?.(); // your custom close logic
    } catch (e) {
      console.error("onClose threw:", e);
    } finally {
      safeBack(fallback); // or router.dismiss() if this is a modal
      // if you need to re-open later, you can reset closing.current = false somewhere appropriate
    }
  }, [onClose, fallback]);
}

export const useAnimateFromPosition = (
  from: { x: number; y: number; width: number; height: number },
  opts: { duration?: number; onClose?: () => void; onOpen?: () => void },
) => {
  const { duration = 350, onClose, onOpen } = opts;
  // shared values
  const animation = useSharedValue({ ...from, progress: 0 });
  const scrim = useSharedValue(0);
  const isFocused = useIsFocused();

  const easeOutEmphasized = Easing.bezier(0.05, 0.7, 0.1, 1);
  const easeInEmphasized = Easing.bezier(0.3, 0, 0.8, 0.15);

  const ZOOM_IN_DELAY = 0; // ms before main anim starts
  const ZOOM_BACK_DELAY = 50; // ms after main anim ends
  const SCRIM_IN_LEAD = duration / 2; // ms before main anim starts
  const SCRIM_OUT_LAG = 0; // ms after main anim ends

  const D_IN = duration + 40;
  const D_OUT = duration;
  const SCRIM_IN_DUR = Math.round(D_IN * 1.33);
  const SCRIM_OUT_DUR = Math.round(D_OUT * 0.55);

  const closeSafely = useSafeOnClose(onClose);

  const { width: W, height: H } = Dimensions.get("window");

  const playOpen = () => {
    // cancel any ongoing to avoid cross-fades stacking
    cancelAnimation(animation);
    cancelAnimation(scrim);

    // scrim starts a bit BEFORE
    scrim.value = withDelay(
      Math.max(0, SCRIM_IN_LEAD - 40), // tiny pre-roll
      withTiming(1, { duration: SCRIM_IN_DUR, easing: easeOutEmphasized }),
    );

    // main card expands
    animation.value = withDelay(
      ZOOM_IN_DELAY,
      withTiming(
        { x: 0, y: 0, width: W, height: H, progress: 1 },
        { duration: Math.round(D_IN * 0.65), easing: easeOutEmphasized },
        (finished) => {
          "worklet";
          if (!isFocused) {
            runOnJS(requestAnimationFrame)(() => onOpen?.());
            return;
          }
          onOpen && runOnJS(onOpen)();
        },
      ),
    );
  };

  const playClose = () => {
    // main card collapses first
    animation.value = withDelay(
      ZOOM_BACK_DELAY,
      withTiming(
        { ...from, progress: 0 },
        { duration: D_OUT, easing: easeInEmphasized },
        (finished) => {
          "worklet";
          if (!isFocused) {
            runOnJS(requestAnimationFrame)(() => closeSafely());
            return;
          }
          runOnJS(closeSafely)();
        },
      ),
    );

    // scrim lingers a bit AFTER, then fades
    scrim.value = withDelay(
      SCRIM_OUT_LAG,
      withTiming(0, { duration: SCRIM_OUT_DUR, easing: easeInEmphasized }),
    );
  };

  useEffect(() => {
    playOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: animation.value.x,
    top: animation.value.y,
    width: animation.value.width,
    height: animation.value.height,
    overflow: "hidden",
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrim.value, // decoupled from progress so it can lead/lag
  }));

  return { animation, cardStyle, scrimStyle, close: playClose };
};

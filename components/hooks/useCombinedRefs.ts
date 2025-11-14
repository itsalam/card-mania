import { useEffect, useRef } from "react";

export const useCombinedRefs = <T>(
    ...refs: Array<React.ForwardedRef<T> | React.RefObject<T> | undefined>
) => {
    const targetRef = useRef<T | null>(null);
    useEffect(() => {
        refs.forEach((ref) => {
            if (!ref) {
                return;
            }
            if (typeof ref === "function") {
                ref(targetRef.current);
            } else {
                ref.current = targetRef.current;
            }
        });
    }, [refs]);
    return targetRef;
};

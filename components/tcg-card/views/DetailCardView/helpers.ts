import { usePriceChartingDataBatch } from "@/client/chart-data";
import { TCard } from "@/constants/types";
import { useOverlayStore } from "@/features/overlay/provider";
import { useAnimateFromPosition } from "@/features/overlay/utils";
import { useNavigation } from "expo-router";
import { useState } from "react";
import { Dimensions } from "react-native";

export const useSelectedGrades = (
    card?: Partial<TCard>,
    preSelectedGrades?: string[],
) => {
    const [selectedGrades, setSelectedGrades] = useState<string[]>(
        preSelectedGrades || [],
    );
    const { data: priceChartingData, ...priceFetchResults } =
        usePriceChartingDataBatch({
            card,
            grades: selectedGrades,
        });

    return {
        selectedGrades,
        setSelectedGrades,
        priceChartingData,
        priceFetchResults,
    };
};

export const useTransitionAnimation = (
    animateFrom: { x: number; y: number; width: number; height: number },
) => {
    const { width: W } = Dimensions.get("window");
    const nav = useNavigation<any>();
    const setHiddenId = useOverlayStore((s) => s.setHiddenId);
    const { cardStyle, scrimStyle, close } = useAnimateFromPosition(
        animateFrom,
        { x: 0, y: 0, width: W, height: W / (5 / 7) },
        {
            onClose: () => {
                setHiddenId(undefined);
                nav.canGoBack()
                    ? nav.goBack()
                    : nav.getParent?.() && nav.getParent()?.goBack();
            },
        },
    );
    return { cardStyle, scrimStyle, close };
};

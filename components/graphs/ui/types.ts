import { SharedValue } from "react-native-reanimated";
import { MaybeNumber } from "victory-native";

export type SeriesSV = { value: SharedValue<number>; position: SharedValue<number> };

export type SeriesPoint = {
    x: number;
    xValue: InputFieldType;
    y: MaybeNumber;
    yValue: MaybeNumber;
}

export type InputFieldType = number | string;
export type InputFields<T> = {
    [K in keyof T as T[K] extends InputFieldType ? K : never]: T[K] extends InputFieldType ? T[K] : never;
};
export type NumericalFields<T> = {
    [K in keyof T as T[K] extends MaybeNumber ? K : never]: T[K];
};

export type PriceGraphProps<T extends Record<string, unknown>, Y extends keyof T & string> = {
    data?: T[]
    width?: number
    height?: number
    xKey: keyof InputFields<T> & string
    yKeys: Y[]
}

import { SharedValue } from "react-native-reanimated";
import { MaybeNumber } from "victory-native";

export type SeriesSV = {
    value: SharedValue<number>;
    position: SharedValue<number>;
};

export type SeriesPoint = {
    x: number;
    xValue: InputFieldType;
    y: MaybeNumber;
    yValue: MaybeNumber;
};

export type InputFieldType = number | string | symbol;

export type GraphInputKey<T> = KeysOfType<RemoveIndex<T>, InputFieldType>;
export type GraphInputFields<T> = {
    [
        K in keyof RemoveIndex<T> as RemoveIndex<T>[K] extends InputFieldType
            ? K : never
    ]: RemoveIndex<T>[K];
};

export type NumericalFields<T> = {
    [K in keyof T as T[K] extends MaybeNumber ? K : InputFieldType]: T[K];
};

export type DefaultKey = string | number;

export type PriceGraphProps<
    T extends Record<string, unknown>,
    InputKey extends keyof GraphInputFields<T> = keyof GraphInputFields<T>,
    YKeys extends keyof NumericalFields<T> = keyof NumericalFields<T>,
> = {
    data?: T[];
    width?: number;
    height?: number;
    xKey: InputKey;
    yKeys: YKeys[];
};

// drop any index signatures from T
type RemoveIndex<T> = {
    [
        K in keyof T as string extends K ? never
            : number extends K ? never
            : symbol extends K ? never
            : K
    ]: T[K];
};

// “keys of T whose values are InputFieldType”
type KeysOfType<T, U> = {
    [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

import _isEmpty from "lodash/isEmpty";
import _isUndefined from "lodash/isUndefined";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ColorValue, TextInputProps } from "react-native";
import { Constants } from "react-native-ui-lib";
import { useDebounce, useDidUpdate } from "react-native-ui-lib/src/hooks";
import { getColorByState, validate } from "./helpers";
import { ColorType, FieldProps, InputProps } from "./types";

import { createContext } from "react";
import {
    interpolate,
    interpolateColor,
    useAnimatedReaction,
    useDerivedValue,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { defaultColors, DURATION } from "./styles";

export type FieldStore = {
    value?: string;
    defaultValue?: string;
    isFocused: boolean;
    hasValue: boolean;
    isValid?: boolean;
    failingValidatorIndex?: number;
    disabled: boolean;
    readonly: boolean;
    validateField: () => void;
    checkValidity: () => boolean;
    isMandatory: boolean;
    forceFloat?: boolean;
    floatOnFocus?: boolean;
    accentColor?: ColorType;
    onFocus?: InputProps["onFocus"];
    onBlur?: InputProps["onBlur"];
    onChangeText?: InputProps["onChangeText"];
};

export const FieldContext = createContext<FieldStore>({
    isFocused: false,
    hasValue: false,
    failingValidatorIndex: undefined,
    disabled: false,
    readonly: false,
    validateField: () => {},
    checkValidity: () => true,
    isMandatory: false,
    forceFloat: false,
    floatOnFocus: false,
});

export default function useFieldState({
    validate: validateProp,
    validationMessage,
    validateOnBlur,
    validateOnChange,
    validationDebounceTime,
    validateOnStart,
    onValidationFailed,
    onChangeValidity,
    accentColor,
    value: _value,
    defaultValue,
    onFocus: _onFocus,
    onBlur: _onBlur,
    onChangeText: _onChangeText,
}: FieldProps) {
    const propsValue = _value ?? defaultValue;
    const [value, setValue] = useState<string | undefined>(propsValue);
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const [isValid, setIsValid] = useState<boolean | undefined>(undefined);
    const [failingValidatorIndex, setFailingValidatorIndex] = useState<
        number | undefined
    >(
        undefined,
    );
    const isMandatory = useMemo(
        () =>
            typeof validate === "string" && validate === "required" ||
            Array.isArray(validate) && validate.includes("required"),
        [validateProp],
    );

    const finalAccentColor = {
        ...defaultColors,
        ...(accentColor instanceof Object ? accentColor : {
            default: accentColor ?? defaultColors.default,
        }),
    };

    useEffect(() => {
        if (
            Constants.isWeb && !_value && defaultValue &&
            defaultValue !== value
        ) {
            setValue(defaultValue);
            if (validateOnStart) {
                validateField(defaultValue);
            }
        }

        /* On purpose listen only to defaultValue change */
        /* eslint-disable-next-line react-hooks/exhaustive-deps*/
    }, [defaultValue, validateOnStart]);
    useEffect(() => {
        if (validateOnStart) {
            validateField();
        }
    }, []);
    const validateField = useCallback((valueToValidate = value) => {
        const [_isValid, _failingValidatorIndex] = validate(
            valueToValidate,
            validateProp,
        );
        setIsValid(_isValid);
        setFailingValidatorIndex(_failingValidatorIndex);
        if (!_isValid && !_isUndefined(_failingValidatorIndex)) {
            onValidationFailed?.(_failingValidatorIndex);
        }
        return _isValid;
    }, [value, validateProp, onValidationFailed]);
    const debouncedValidateField = useDebounce(
        validateField,
        validationDebounceTime,
    );

    useEffect(() => {
        if (propsValue !== value) {
            setValue(propsValue);
            if (validateOnChange) {
                if (validationDebounceTime) {
                    debouncedValidateField(propsValue ?? "");
                } else {
                    validateField(propsValue ?? "");
                }
            }
        }
        /* On purpose listen only to propsValue change */
        /* eslint-disable-next-line react-hooks/exhaustive-deps*/
    }, [propsValue, validateOnChange]);

    useDidUpdate(() => {
        if (!_isUndefined(isValid)) {
            onChangeValidity?.(isValid);
        }
    }, [isValid]);

    const checkValidity = useCallback((valueToValidate = value) => {
        const [_isValid] = validate(valueToValidate, validateProp);
        return _isValid;
    }, [value, validateProp]);

    const onFocus = useCallback<NonNullable<TextInputProps["onFocus"]>>(
        (...args) => {
            setIsFocused(true);
            _onFocus?.(...args);
        },
        [_onFocus],
    );

    const onBlur = useCallback<NonNullable<TextInputProps["onBlur"]>>(
        (...args) => {
            setIsFocused(false);
            _onBlur?.(...args);
            if (validateOnBlur) {
                validateField();
            }
        },
        [_onBlur, validateOnBlur, validateField],
    );

    const onChangeText = useCallback<
        NonNullable<TextInputProps["onChangeText"]>
    >((text) => {
        console.log("HUH", { text });
        setValue(text);
        _onChangeText?.(text);
        if (validateOnChange) {
            if (validationDebounceTime) {
                debouncedValidateField(text);
            } else {
                validateField(text);
            }
        }
    }, [
        _onChangeText,
        validateOnChange,
        debouncedValidateField,
        validateField,
    ]);

    const fieldState = useMemo(() => {
        return {
            value,
            hasValue: !_isEmpty(value),
            isValid: validationMessage && !validateProp
                ? false
                : isValid ?? true,
            isFocused,
            failingValidatorIndex,
            isMandatory,
            accentColor: finalAccentColor,
        };
    }, [
        value,
        isFocused,
        isValid,
        failingValidatorIndex,
        validationMessage,
        validateProp,
        isMandatory,
        finalAccentColor,
    ]);
    return {
        onFocus,
        onBlur,
        onChangeText,
        fieldState,
        validateField,
        checkValidity,
    };
}

export const useInputColors = () => {
    const context = useContext<FieldStore>(FieldContext);
    const ctxColor = useMemo(() => getColorByState(context)!, [context]);
    const ctxOpacity = useMemo(() => context.isFocused ? 1 : 0, [context]);

    return useAnimatedColors(ctxColor, ctxOpacity);
};

export const useAnimatedColors = (
    ctxColor: string,
    ctxOpacity: number,
) => {
    const ctxOpacityValue = useDerivedValue(
        () => withTiming(ctxOpacity, { duration: DURATION / 2 }),
        [ctxOpacity],
    );

    const colorT = useSharedValue(1);
    const fromColor = useSharedValue(ctxColor);
    const toColor = useSharedValue(fromColor.value);
    const opacity = useDerivedValue(() =>
        interpolate(ctxOpacityValue.value, [0, 1], [0.4, 1])
    );

    const color = useDerivedValue(() => {
        const c = interpolateColor(colorT.value, [0, 1], [
            fromColor.value!,
            toColor.value!,
            "RGB",
        ]);
        return c as ColorValue;
    });

    useEffect(() => {
        toColor.value = ctxColor;
    }, [ctxColor]);

    useAnimatedReaction(
        () => toColor.value,
        (to, prevTo) => {
            if (to !== prevTo) {
                // capture current on-screen color as new "from"
                fromColor.value = color.value as string;
                colorT.value = 0;
                colorT.value = withTiming(1, { duration: DURATION });
            }
        },
    );

    return { color, opacity };
};

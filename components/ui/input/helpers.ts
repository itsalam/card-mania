import { EmailValidator } from "commons-validator-js";
import _isEmpty from "lodash/isEmpty";
import _isPlainObject from "lodash/isPlainObject";
import _isString from "lodash/isString";
import React from "react";
import { Colors } from "react-native-ui-lib";
import { FieldStore } from "./provider";
import { Validator } from "./types";

const urlRegEx =
    /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i; //eslint-disable-line
const decimalNumberRegEx = /^-?\d+[.,]?\d+$/;
const integerRegEx = /^-?\d*$/; // allows empty string
const priceRegEx = /^[0-9]{1,9}([.][0-9]{1,2})?$/;

export const validators: Record<
    Extract<Validator, string>,
    (value: string | undefined) => boolean
> = {
    required: (value = "") => !_isEmpty(value),
    email: (value = "") => new EmailValidator().isValid(value),
    optionalEmail: (value = "") => {
        // Allow empty strings
        if (_isEmpty(value)) {
            return true;
        }
        return new EmailValidator().isValid(value);
    },
    url: (value = "") => urlRegEx.test(value),
    number: (value = "") =>
        integerRegEx.test(value) || decimalNumberRegEx.test(value),
    price: (value = "") => priceRegEx.test(value),
};

export function validate(
    value?: string,
    validator?: Validator | Validator[],
): [boolean, number | undefined] {
    if (!!!validator || !!!value || validator.length === 0) {
        return [true, undefined];
    }
    let _isValid = true;
    let _failingValidatorIndex;
    const _validators = Array.isArray(validator) ? validator : [validator];
    _validators.forEach((validator, index) => {
        if (typeof validator === "function") {
            _isValid = validator(value);
        } else if (typeof validator === "string") {
            _isValid = validators[validator]?.(value || "");
        }
        if (!_isValid) {
            _failingValidatorIndex = index;
            return false;
        }
    });

    return [_isValid, _failingValidatorIndex];
}

export function isFragment(
    el: React.ReactElement | undefined,
): el is React.ReactElement<any, typeof React.Fragment> {
    return !!el && el.type === React.Fragment;
}

export function shouldPlaceholderFloat({
    defaultValue,
    floatOnFocus,
    forceFloat,
    isFocused,
    hasValue,
    value,
}: FieldStore) {
    const useDefaultValue = !_isEmpty(defaultValue) && value === undefined;
    return forceFloat || (floatOnFocus && isFocused) || hasValue ||
        useDefaultValue;
}

export function getColorByState(context?: FieldStore) {
    const color = context?.accentColor || Colors.$textDefault;
    let finalColor;
    if (_isString(color)) {
        finalColor = color;
    } else if (Colors.isDesignToken(color)) {
        finalColor = color?.toString();
    } else if (_isPlainObject(color)) {
        if (context?.disabled) {
            finalColor = color?.disabled;
        } else if (context?.readonly) {
            finalColor = color?.readonly;
        } else if (!context?.isValid) {
            finalColor = color?.error;
        } else if (context?.isFocused) {
            finalColor = color?.focus;
        }
        finalColor = finalColor || color?.default || Colors.$textDefault;
    }
    return finalColor;
}

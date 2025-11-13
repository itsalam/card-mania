import { StyleSheet } from "react-native";

import { Colors } from "react-native-ui-lib";

export const defaultColors = {
    default: Colors.$textNeutralLight,
    focus: Colors.$textPrimary,
    error: Colors.$textDanger,
    disabled: Colors.$textDisabled,
    readonly: Colors.$textNeutralLight,
};

export const DURATION = 600;
export const GAP_PADDING = 20;
export const BASE_PLACEHOLDER_FONT_SIZE = 14;
export const FLOATING_PLACEHOLDER_SCALE = 0.875;

export const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        paddingHorizontal: 18,
        paddingTop: GAP_PADDING,
        paddingBottom: 12,
        flex: 1,
    },
    inputTextStyle: {
        fontSize: 20,
        lineHeight: 22,
    },
    inputBody: {
        flex: 1,
    },
    floatingPlaceholderTextStyle: {
        fontSize: BASE_PLACEHOLDER_FONT_SIZE,
        lineHeight: BASE_PLACEHOLDER_FONT_SIZE + 4,
    },
    floatingPlaceholderDisplayStyle: { lineHeight: 14 },
    input: {
        // borderColor: Colors.rgba(Colors.$backgroundNeutralMedium, 1.0),
        borderWidth: 2,
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderRadius: 12,
    },
    centeredContainer: {
        alignSelf: "center",
    },
    centeredText: {
        textAlign: "center",
    },
    dummyPlaceholder: {
        height: 0,
    },
});

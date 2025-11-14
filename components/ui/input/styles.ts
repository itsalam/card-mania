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
        marginTop: 18,
    },
    floatingPlaceholderTextStyle: {
        fontSize: BASE_PLACEHOLDER_FONT_SIZE,
        lineHeight: BASE_PLACEHOLDER_FONT_SIZE + 4,
    },
    floatingPlaceholderDisplayStyle: { lineHeight: 14 },
    input: {
        // borderColor: Colors.rgba(Colors.$backgroundNeutralMedium, 1.0),
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderRadius: 12,
    },
    field: {
        flexDirection: "row",
        alignItems: "center",
        position: "relative",
        justifyContent: "flex-start",
        flexWrap: "wrap",
        rowGap: 6,
        columnGap: 8,
        zIndex: 1,
        flex: 1,
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

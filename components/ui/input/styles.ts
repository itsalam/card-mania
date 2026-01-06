import { StyleSheet } from "react-native";

import { Colors } from "react-native-ui-lib";
import { BADGE_HEIGHT } from "../badge";

export const defaultColors = {
    default: Colors.$textNeutralLight,
    focus: Colors.$textPrimary,
    error: Colors.$textDanger,
    disabled: Colors.$textDisabled,
    readonly: Colors.$textNeutralLight,
};

export const DURATION = 600;
export const GAP_PADDING = 6;
export const BASE_PLACEHOLDER_FONT_SIZE = 14;
export const FLOATING_PLACEHOLDER_SCALE = 0.875;

export const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 8,
        paddingTop: GAP_PADDING,
        paddingBottom: 6,
    },
    inputTextStyle: {
        fontSize: 20,
        lineHeight: 24,
        color: Colors.$textDefault,
    },
    inputBody: {
        flex: 1,
    },
    floatingPlaceholderTextStyle: {
        fontSize: BASE_PLACEHOLDER_FONT_SIZE,
        lineHeight: BASE_PLACEHOLDER_FONT_SIZE + 2,
    },
    floatingPlaceholderDisplayStyle: { lineHeight: 14 },
    input: {
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    field: {
        flexDirection: "row",
        alignContent: "center",
        alignItems: "center",
        position: "relative",
        justifyContent: "flex-start",
        flexWrap: "wrap",
        rowGap: 6,
        columnGap: 4,
        zIndex: 1,
        flex: 1,
        minHeight: BADGE_HEIGHT + GAP_PADDING,
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

import { StyleSheet } from "react-native";
import { Colors } from "react-native-ui-lib";

export const FooterStyles = StyleSheet.create({
    titleFloatingPlaceholderStyle: { fontSize: 28, lineHeight: 48 },
    formContainer: {
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
        borderColor: Colors.rgba(Colors.$backgroundNeutralHeavy, 0.1),
        borderWidth: 2,
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderRadius: 12,
    },
    titleInputBody: {
        fontWeight: "500",
        fontSize: 32,
        lineHeight: 40,
    },
    attributeInputContainer: {
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
        borderColor: Colors.rgba(Colors.$backgroundNeutralMedium, 1.0),
        borderWidth: 2,
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderRadius: 12,
    },
    attributeInputBody: {
        fontWeight: "500",
        fontSize: 20,
        lineHeight: 22,
    },
    tagsInputBody: {
        padding: 0,
        margin: 0,
    },

    attributeFloatingPlaceholderStyle: { fontSize: 14, lineHeight: 20 },
    input: {
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
        borderColor: Colors.rgba(Colors.$backgroundNeutralMedium, 1.0),
        borderWidth: 2,
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderRadius: 12,
        height: 80,
    },
    footerButton: {},
});

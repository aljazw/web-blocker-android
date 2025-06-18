import React from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from "react-native";
import { shapes, spacing, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";


interface BaseScreenProps {
    children: React.ReactNode;
    title?: string;
    isLoading?: boolean;
    customStyles?: object;
    showHeader?: boolean;
}

const BaseScreen: React.FC<BaseScreenProps> = ({
    children,
    title,
    isLoading = false,
    customStyles = {},
    showHeader = true
}) => {

    const { theme } = useTheme();

    return (
        <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background}, customStyles]}>
            {showHeader && (
                <View style={[styles.header, {borderBottomColor: theme.colors.border}]}>
                    {title && <ThemedText size="xlarge" weight="strong">{title}</ThemedText>}
                </View>
            )}

            <View style={[styles.content, customStyles]}>
                {isLoading ? (
                    <ActivityIndicator size="large" color="#0000ff" />
                ) : (
                    children
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: spacing.md,
        borderWidth: shapes.borderWidth.thin,
    },
    content: {
        flex: 1,
    },
})

export default BaseScreen;
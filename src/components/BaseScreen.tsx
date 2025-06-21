import React from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from "react-native";
import { shapes, spacing, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";


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
                <View style={styles.header}>
                    {title && <ThemedText size="xlarge" weight="strong">{title}</ThemedText>}
                </View>
            )}
            <ThemedView withBorder style={styles.lineDivider}></ThemedView>
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
    },
    lineDivider: {
        height: 1,
    },
    content: {
        flex: 1,
    },
})

export default BaseScreen;
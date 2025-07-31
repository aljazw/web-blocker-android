import React, { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '../theme';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import changeNavigationBarColor from 'react-native-navigation-bar-color';

interface BaseScreenProps {
    children: React.ReactNode;
    title?: string;
    isLoading?: boolean;
    style?: object;
    showHeader?: boolean;
}

const BaseScreen: React.FC<BaseScreenProps> = ({
    children,
    title,
    isLoading = false,
    style = {},
    showHeader = true,
}) => {
    const { theme, isDarkMode } = useTheme();

    useEffect(() => {
        if (isDarkMode) {
            changeNavigationBarColor('#000000', false);
        } else {
            changeNavigationBarColor('#FFFFFF', true);
        }
    }, [isDarkMode]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
            {showHeader && (
                <>
                    <View style={styles.header}>
                        {title && (
                            <ThemedText size="xlarge" weight="strong">
                                {title}
                            </ThemedText>
                        )}
                    </View>
                    <ThemedView withBorder style={styles.lineDivider} />
                </>
            )}

            <View style={[styles.content, style]}>
                {isLoading ? <ActivityIndicator size="large" color="#0000ff" /> : children}
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
});

export default BaseScreen;

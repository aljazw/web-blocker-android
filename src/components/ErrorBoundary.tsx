import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import Button from './Button';
import { spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { logger } from '../utils/logger';

interface State {
    error: Error | null;
}

/**
 * Last line of defense: if any screen throws while rendering, show a calm
 * recovery screen instead of a crash. Blocking itself runs natively and is
 * unaffected by UI errors.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        logger.error('Unhandled UI error', { error, componentStack: info.componentStack });
    }

    render() {
        if (this.state.error) {
            return <Fallback onRetry={() => this.setState({ error: null })} />;
        }
        return this.props.children;
    }
}

const Fallback: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
    const { theme } = useTheme();
    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ThemedText size="xlarge" weight="strong" align="center">
                Something went wrong
            </ThemedText>
            <ThemedText color="muted" align="center" style={styles.text}>
                Your blocks are still active — this only affected the app screen.
            </ThemedText>
            <Button label="Try again" onPress={onRetry} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.xl,
    },
    text: {
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
    },
});

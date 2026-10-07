import React from 'react';
import { StyleSheet, Image, ScrollView, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { shapes, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ACCESSIBILITY_SETUP_STEPS } from '../constants/strings';
import { FadeIn, stagger } from '../components/Motion';

interface WelcomeScreenProps {
    onContinue: () => void;
}

const HIGHLIGHTS = [
    { title: 'Block on your terms', text: 'All day, work hours, bedtime — you pick when.' },
    { title: 'Hard to switch off', text: 'Passphrase, uninstall prevention and a watchdog keep you honest.' },
    { title: 'Private by design', text: 'Everything runs on your phone. No accounts, no tracking.' },
];

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
    const { theme } = useTheme();

    return (
        <BaseScreen showHeader={false}>
            <ScrollView contentContainerStyle={styles.container}>
                <FadeIn offset={24}>
                    <View style={[styles.logoWrap, { backgroundColor: theme.colors.accentSoft }]}>
                        <Image
                            source={require('../assets/icons/ic_sitelock.png')}
                            style={styles.image}
                            resizeMode="contain"
                        />
                    </View>
                    <ThemedText weight="strong" size="display" align="center">
                        SiteLock
                    </ThemedText>
                    <ThemedText align="center" color="muted" style={styles.subtitle}>
                        Take back your focus. Block distracting websites — and make it stick.
                    </ThemedText>
                </FadeIn>

                {HIGHLIGHTS.map((h, i) => (
                    <FadeIn key={h.title} delay={150 + stagger(i, 90)}>
                        <ThemedView withBorder style={styles.highlight}>
                            <View style={[styles.highlightDot, { backgroundColor: theme.colors.accent }]} />
                            <View style={styles.flex}>
                                <ThemedText weight="strong">{h.title}</ThemedText>
                                <ThemedText size="small" color="muted">
                                    {h.text}
                                </ThemedText>
                            </View>
                        </ThemedView>
                    </FadeIn>
                ))}

                <FadeIn delay={450}>
                    <ThemedText size="tiny" weight="strong" color="muted" style={styles.stepsTitle}>
                        ONE-TIME SETUP
                    </ThemedText>
                    <StepList />

                    <Button label="Enable Accessibility" icon="ArrowRight" onPress={onContinue} style={styles.button} />
                </FadeIn>
            </ScrollView>
        </BaseScreen>
    );
};

export function StepList() {
    const { theme } = useTheme();
    return (
        <ThemedView withBorder style={styles.steps}>
            {ACCESSIBILITY_SETUP_STEPS.map((step, index) => (
                <View key={index} style={styles.stepRow}>
                    <View style={[styles.stepNumber, { backgroundColor: theme.colors.accentSoft }]}>
                        <ThemedText size="tiny" weight="strong" color="accent">
                            {index + 1}
                        </ThemedText>
                    </View>
                    <ThemedText size="small" style={styles.flex}>
                        {step}
                    </ThemedText>
                </View>
            ))}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: spacing.lg,
        paddingTop: spacing.xl,
    },
    flex: {
        flex: 1,
    },
    logoWrap: {
        alignSelf: 'center',
        width: 120,
        height: 120,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    image: {
        width: 84,
        height: 84,
    },
    subtitle: {
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.md,
    },
    highlight: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: spacing.md,
        borderRadius: shapes.borderRadius.medium,
        marginBottom: spacing.sm,
    },
    highlightDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 7,
        marginRight: spacing.sm + 2,
    },
    stepsTitle: {
        letterSpacing: 1.2,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
        marginLeft: 4,
    },
    steps: {
        padding: spacing.md,
        borderRadius: shapes.borderRadius.medium,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 5,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    button: {
        marginTop: spacing.xl,
    },
});

export default WelcomeScreen;

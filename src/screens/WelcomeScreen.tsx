import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import { IconName } from '../components/Icon';
import SectionHeader from '../components/SectionHeader';
import { ThemedText } from '../components/ThemedText';
import { FadeIn, stagger } from '../components/Motion';
import { useTheme } from '../context/ThemeContext';
import { gutter, shapes, spacing } from '../theme';
import { ACCESSIBILITY_SETUP_STEPS } from '../constants/strings';

interface WelcomeScreenProps {
    onContinue: () => void;
}

const HIGHLIGHTS: { icon: IconName; title: string; text: string }[] = [
    { icon: 'Ban', title: 'Block distractions', text: 'Websites and apps, all day or on the schedule you choose.' },
    { icon: 'Habits', title: 'Build habits', text: 'Daily check-ins, streaks and reminders on the days you pick.' },
    { icon: 'Waves', title: 'Train breath-holds', text: 'CO₂ and O₂ tables, max-hold tests and breathing exercises.' },
    {
        icon: 'Shield',
        title: 'Private and robust',
        text: 'Runs entirely on your phone. Hard to switch off on impulse.',
    },
];

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
    const { theme } = useTheme();

    return (
        <BaseScreen showHeader={false}>
            <ScrollView contentContainerStyle={styles.container}>
                <FadeIn>
                    <View
                        style={[styles.logo, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <Image
                            source={require('../assets/icons/ic_gaman.png')}
                            style={styles.image}
                            resizeMode="contain"
                        />
                    </View>
                    <ThemedText weight="bold" size="display" style={styles.title}>
                        Gaman
                    </ThemedText>
                    <ThemedText color="muted" size="large" style={styles.subtitle}>
                        Focus and self-improvement. Remove distractions, build routines and train your breath.
                    </ThemedText>
                </FadeIn>

                <Card style={styles.highlights} flush>
                    {HIGHLIGHTS.map((h, i) => (
                        <FadeIn key={h.title} delay={80 + stagger(i, 50)}>
                            <View
                                style={[
                                    styles.highlight,
                                    i > 0 && {
                                        borderTopColor: theme.colors.border,
                                        borderTopWidth: StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                <IconTile icon={h.icon} tone="accent" size={36} />
                                <View style={styles.flex}>
                                    <ThemedText weight="medium">{h.title}</ThemedText>
                                    <ThemedText size="small" color="muted">
                                        {h.text}
                                    </ThemedText>
                                </View>
                            </View>
                        </FadeIn>
                    ))}
                </Card>

                <FadeIn delay={300}>
                    <SectionHeader title="One-time setup" />
                    <StepList />
                    <Button label="Open Accessibility settings" onPress={onContinue} style={styles.button} />
                </FadeIn>
            </ScrollView>
        </BaseScreen>
    );
};

export function StepList() {
    const { theme } = useTheme();
    return (
        <Card>
            {ACCESSIBILITY_SETUP_STEPS.map((step, index) => (
                <View key={index} style={styles.stepRow}>
                    <View style={[styles.stepNumber, { borderColor: theme.colors.border }]}>
                        <ThemedText size="tiny" weight="strong" color="muted" tabular>
                            {index + 1}
                        </ThemedText>
                    </View>
                    <ThemedText size="small" style={styles.flex}>
                        {step}
                    </ThemedText>
                </View>
            ))}
        </Card>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: spacing.xl,
        paddingBottom: spacing.xl,
    },
    flex: {
        flex: 1,
    },
    logo: {
        width: 64,
        height: 64,
        borderRadius: shapes.borderRadius.large,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: gutter,
        marginBottom: spacing.lg,
    },
    image: {
        width: 40,
        height: 40,
    },
    title: {
        marginHorizontal: gutter,
    },
    subtitle: {
        marginTop: spacing.sm,
        marginHorizontal: gutter,
        lineHeight: 24,
    },
    highlights: {
        marginTop: spacing.xl,
    },
    highlight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 2,
        padding: spacing.md,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 5,
    },
    stepNumber: {
        width: 22,
        height: 22,
        borderRadius: shapes.borderRadius.small,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    button: {
        marginHorizontal: gutter,
        marginTop: spacing.xl,
    },
});

export default WelcomeScreen;

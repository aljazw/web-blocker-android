import React from 'react';
import { Text, StyleSheet, Image, TouchableOpacity, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import { ThemedText } from '../components/ThemedText';
import { shapes, spacing } from '../theme';
import { ACCESSIBILITY_SETUP_STEPS } from '../constants/strings';

interface WelcomeScreenProps {
    onContinue: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
    return (
        <BaseScreen showHeader={false}>
            <View style={styles.container}>
                <Image source={require('../assets/icons/ic_sitelock.png')} style={styles.image} resizeMode="contain" />
                <ThemedText weight="strong" size="xlarge" align="center" style={styles.title}>
                    Welcome to SiteLock
                </ThemedText>
                <ThemedText align="center" size="large" weight="medium" style={styles.subtitle}>
                    To block distracting websites, please enable Accessibility permissions.
                </ThemedText>
                <StepList />
                <TouchableOpacity onPress={onContinue} style={styles.button}>
                    <Text style={styles.buttonText}>Enable Accessibility</Text>
                </TouchableOpacity>
            </View>
        </BaseScreen>
    );
};

export function StepList() {
    return (
        <View>
            {ACCESSIBILITY_SETUP_STEPS.map((step, index) => (
                <ThemedText key={index} style={styles.item}>
                    {`${index + 1}️⃣ ${step}`}
                </ThemedText>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        marginTop: spacing.xl,
        padding: spacing.lg,
    },
    image: {
        width: 180,
        height: 180,
    },
    title: {
        marginBottom: spacing.xxl,
    },
    subtitle: {
        marginBottom: spacing.lg,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: shapes.borderRadius.medium,
        backgroundColor: '#3b82f6', // a strong primary blue
        elevation: shapes.elevation.medium,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: shapes.elevation.medium,
        marginTop: spacing.xxl,
        alignSelf: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        textAlign: 'center',
    },
    item: {
        marginVertical: 2,
    },
});

export default WelcomeScreen;

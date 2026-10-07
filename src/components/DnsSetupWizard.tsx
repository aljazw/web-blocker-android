import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import BlurModal from './BlurModal';
import { ThemedText } from './ThemedText';
import { spacing } from '../theme';
import {
    enableDnsBlocking,
    openPrivateDnsSettings,
    openVpnSettings,
} from '../utils/dnsBlocking';

interface DnsSetupWizardProps {
    visible: boolean;
    onClose: () => void;
    onDnsEnabledChange: (enabled: boolean) => void;
}

const TOTAL_STEPS = 4;

const DnsSetupWizard: React.FC<DnsSetupWizardProps> = ({ visible, onClose, onDnsEnabledChange }) => {
    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const [enableError, setEnableError] = useState<string | null>(null);

    const reset = () => {
        setStep(0);
        setBusy(false);
        setEnableError(null);
    };

    const finish = () => {
        reset();
        onClose();
    };

    const handleEnable = async () => {
        setBusy(true);
        setEnableError(null);
        const ok = await enableDnsBlocking();
        setBusy(false);
        if (ok) {
            onDnsEnabledChange(true);
            setStep(1);
        } else {
            setEnableError('You declined the VPN permission. Tap "Turn on DNS blocking" again and choose OK.');
        }
    };

    return (
        <BlurModal visible={visible} onClose={finish}>
            <ThemedText size="small" opacity="faded" align="center" style={styles.counter}>
                Step {step + 1} of {TOTAL_STEPS}
            </ThemedText>

            {step === 0 && (
                <>
                    <ThemedText weight="strong" size="large" align="center" style={styles.title}>
                        1. Turn on the DNS filter
                    </ThemedText>
                    <ThemedText align="center" style={styles.body}>
                        This starts the on-device filter. Android will ask you to allow a VPN connection — tap{' '}
                        <ThemedText weight="strong">OK</ThemedText>. Nothing leaves your phone.
                    </ThemedText>
                    {enableError && (
                        <ThemedText color="primaryRed" align="center" size="small" style={styles.body}>
                            {enableError}
                        </ThemedText>
                    )}
                    <PrimaryButton label={busy ? 'Waiting…' : 'Turn on DNS blocking'} onPress={handleEnable} disabled={busy} />
                </>
            )}

            {step === 1 && (
                <>
                    <ThemedText weight="strong" size="large" align="center" style={styles.title}>
                        2. Turn OFF Private DNS
                    </ThemedText>
                    <ThemedText align="center" style={styles.body}>
                        Private DNS encrypts your lookups so the filter can’t read them. I’ll open the page — set it to{' '}
                        <ThemedText weight="strong">Off</ThemedText>, then come back here.
                    </ThemedText>
                    <ThemedText align="center" size="small" color="primaryBlue" style={styles.body}>
                        Used AdGuard here? You won’t lose it — after setup, set “Allowed-sites resolver” to AdGuard in
                        Settings and you keep ad/tracker blocking too.
                    </ThemedText>
                    <SecondaryButton label="Open Private DNS settings" onPress={() => openPrivateDnsSettings()} />
                    <PrimaryButton label="I set it to Off — Next" onPress={() => setStep(2)} />
                    <BackButton onPress={() => setStep(0)} />
                </>
            )}

            {step === 2 && (
                <>
                    <ThemedText weight="strong" size="large" align="center" style={styles.title}>
                        3. Turn off Chrome’s Secure DNS
                    </ThemedText>
                    <ThemedText align="center" style={styles.body}>
                        Chrome can run its own encrypted DNS. In Chrome: ⋮ → Settings → Privacy and security →{' '}
                        <ThemedText weight="strong">Use secure DNS → Off</ThemedText>. Skip if you don’t use Chrome.
                    </ThemedText>
                    <PrimaryButton label="Next" onPress={() => setStep(3)} />
                    <BackButton onPress={() => setStep(1)} />
                </>
            )}

            {step === 3 && (
                <>
                    <ThemedText weight="strong" size="large" align="center" style={styles.title}>
                        4. Make it permanent
                    </ThemedText>
                    <ThemedText align="center" style={styles.body}>
                        So it can’t be dropped in a couple taps. I’ll open VPN settings — tap the gear next to{' '}
                        <ThemedText weight="strong">SiteLock</ThemedText>, then turn on{' '}
                        <ThemedText weight="strong">Always-on VPN</ThemedText> and{' '}
                        <ThemedText weight="strong">Block connections without VPN</ThemedText>.
                    </ThemedText>
                    <SecondaryButton label="Open VPN settings" onPress={() => openVpnSettings()} />
                    <PrimaryButton label="Finish" onPress={finish} />
                    <BackButton onPress={() => setStep(2)} />
                </>
            )}
        </BlurModal>
    );
};

const PrimaryButton: React.FC<{ label: string; onPress: () => void; disabled?: boolean }> = ({
    label,
    onPress,
    disabled,
}) => (
    <Pressable
        onPress={disabled ? undefined : onPress}
        style={[styles.primaryBtn, disabled && styles.btnDisabled]}>
        <ThemedText weight="strong" style={styles.primaryBtnText}>
            {label}
        </ThemedText>
    </Pressable>
);

const SecondaryButton: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
    <Pressable onPress={onPress} style={styles.secondaryBtn}>
        <ThemedText weight="strong" color="primaryBlue">
            {label}
        </ThemedText>
    </Pressable>
);

const BackButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
    <Pressable onPress={onPress} style={styles.backBtn}>
        <ThemedText size="small" opacity="faded">
            Back
        </ThemedText>
    </Pressable>
);

const styles = StyleSheet.create({
    counter: {
        marginBottom: spacing.xs,
    },
    title: {
        marginBottom: spacing.sm,
    },
    body: {
        marginBottom: spacing.md,
    },
    primaryBtn: {
        backgroundColor: '#1976D2',
        borderRadius: 24,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    primaryBtnText: {
        color: '#FFFFFF',
    },
    btnDisabled: {
        opacity: 0.6,
    },
    secondaryBtn: {
        borderWidth: 1,
        borderColor: '#1976D2',
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    backBtn: {
        alignItems: 'center',
        paddingVertical: 10,
        marginTop: spacing.xs,
    },
});

export default DnsSetupWizard;

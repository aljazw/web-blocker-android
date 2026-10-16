import { APP_NAME } from '../constants/brand';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import ModalPanel from './ModalPanel';
import { ThemedText } from './ThemedText';
import { spacing } from '../theme';
import Button from './Button';
import {
    enableDnsBlocking,
    getPrivateDnsHost,
    getUpstreamDns,
    openPrivateDnsSettings,
    openVpnSettings,
    setUpstreamDns,
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
    // Android's Private DNS hostname, read before the user turns it off so
    // the app can keep using that provider (encrypted) for allowed sites.
    const [privateHost, setPrivateHost] = useState<string | null>(null);
    const [hostSaved, setHostSaved] = useState(false);

    useEffect(() => {
        if (!visible) {
            return;
        }
        Promise.all([getPrivateDnsHost(), getUpstreamDns()]).then(([host, upstream]) => {
            setPrivateHost(host);
            setHostSaved(!!host && host === upstream);
        });
    }, [visible, step]);

    const keepProvider = async () => {
        if (privateHost) {
            await setUpstreamDns(privateHost);
            setHostSaved(true);
        }
    };

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
        <ModalPanel visible={visible} onClose={finish}>
            <ThemedText size="tiny" weight="strong" color="muted" caps style={styles.counter}>
                Step {step + 1} of {TOTAL_STEPS}
            </ThemedText>

            {step === 0 && (
                <>
                    <ThemedText weight="bold" size="large" style={styles.title}>
                        1. Turn on the DNS filter
                    </ThemedText>
                    <ThemedText color="muted" style={styles.body}>
                        This starts the on-device filter. Android will ask you to allow a VPN connection; tap{' '}
                        <ThemedText weight="strong">OK</ThemedText>. Nothing leaves your phone.
                    </ThemedText>
                    {enableError && (
                        <ThemedText color="primaryRed" size="small" style={styles.body}>
                            {enableError}
                        </ThemedText>
                    )}
                    <PrimaryButton
                        label={busy ? 'Waiting…' : 'Turn on DNS blocking'}
                        onPress={handleEnable}
                        disabled={busy}
                    />
                </>
            )}

            {step === 1 && (
                <>
                    <ThemedText weight="bold" size="large" style={styles.title}>
                        2. Turn OFF Private DNS
                    </ThemedText>
                    <ThemedText color="muted" style={styles.body}>
                        While Private DNS is set to a provider, Android talks to it directly and the filter steps aside
                        (your internet keeps working, but sites aren’t blocked by DNS). Set it to{' '}
                        <ThemedText weight="strong">Off</ThemedText>, then come back here.
                    </ThemedText>
                    {privateHost && (
                        <>
                            <ThemedText size="small" color="accent" style={styles.body}>
                                {hostSaved
                                    ? `${APP_NAME} now uses ${privateHost} for allowed sites, encrypted, so its ad and tracker blocking keeps working.`
                                    : `You use ${privateHost}. Keep it: ${APP_NAME} can send allowed sites there, encrypted.`}
                            </ThemedText>
                            {!hostSaved && <PrimaryButton label={`Keep ${privateHost}`} onPress={keepProvider} />}
                        </>
                    )}
                    <SecondaryButton label="Open Private DNS settings" onPress={() => openPrivateDnsSettings()} />
                    <PrimaryButton label="It's off. Next" onPress={() => setStep(2)} />
                    <BackButton onPress={() => setStep(0)} />
                </>
            )}

            {step === 2 && (
                <>
                    <ThemedText weight="bold" size="large" style={styles.title}>
                        3. Turn off Chrome’s Secure DNS
                    </ThemedText>
                    <ThemedText color="muted" style={styles.body}>
                        Chrome can run its own encrypted DNS. In Chrome open Settings, Privacy and security,{' '}
                        <ThemedText weight="strong">Use secure DNS: Off</ThemedText>. Skip this if you don’t use Chrome.
                    </ThemedText>
                    <PrimaryButton label="Next" onPress={() => setStep(3)} />
                    <BackButton onPress={() => setStep(1)} />
                </>
            )}

            {step === 3 && (
                <>
                    <ThemedText weight="bold" size="large" style={styles.title}>
                        4. Make it permanent
                    </ThemedText>
                    <ThemedText color="muted" style={styles.body}>
                        So it can’t be switched off in a couple of taps. In VPN settings, tap the gear next to{' '}
                        <ThemedText weight="strong">{APP_NAME}</ThemedText>, then turn on{' '}
                        <ThemedText weight="strong">Always-on VPN</ThemedText> and{' '}
                        <ThemedText weight="strong">Block connections without VPN</ThemedText>.
                    </ThemedText>
                    <SecondaryButton label="Open VPN settings" onPress={() => openVpnSettings()} />
                    <PrimaryButton label="Finish" onPress={finish} />
                    <BackButton onPress={() => setStep(2)} />
                </>
            )}
        </ModalPanel>
    );
};

const PrimaryButton: React.FC<{ label: string; onPress: () => void; disabled?: boolean }> = ({
    label,
    onPress,
    disabled,
}) => <Button label={label} onPress={onPress} disabled={disabled} style={styles.button} />;

const SecondaryButton: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
    <Button variant="secondary" label={label} onPress={onPress} style={styles.button} />
);

const BackButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
    <Button variant="ghost" compact label="Back" onPress={onPress} style={styles.button} />
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
    button: {
        alignSelf: 'stretch',
        marginTop: spacing.xs + 2,
    },
});

export default DnsSetupWizard;

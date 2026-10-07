import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import { Pressable, Switch } from 'react-native-gesture-handler';
import { useEffect, useRef, useState } from 'react';
import { spacing } from '../theme';
import { ThemedText } from '../components/ThemedText';
import BlurModal from '../components/BlurModal';
import ActionButton from '../components/ActionButton';
import { usePassphrase } from '../context/PassphraseContext';
import PassphrasePopup from '../components/PassphrasePopup';
import { ThemedView } from '../components/ThemedView';
import { checkAdmin, toggleDeviceAdmin } from '../utils/deviceAdmin';
import { ERRORS, PASSPHRASE_PROTECTION, UNINSTALL_PREVENTION } from '../constants/strings';
import ErrorPopup from '../components/ErrorPopup';
import { useTheme } from '../context/ThemeContext';
import Icon from '../components/Icon';
import { checkAccessibilityEnabled, openAccessibilitySettings } from '../utils/accessibility';
import {
    ADGUARD_DNS,
    disableDnsBlocking,
    getDnsStats,
    getUpstreamDns,
    isDnsBlockingRunning,
    setUpstreamDns,
    DnsStats,
} from '../utils/dnsBlocking';
import { canDrawOverlays, requestOverlay } from '../utils/overlay';
import { getBlockedWebsites } from '../utils/storage';
import { isWatchdogRunning, testWatchdogWarning } from '../utils/watchdog';
import DnsSetupWizard from '../components/DnsSetupWizard';

const SettingsScreen: React.FC = () => {
    const { isDarkMode, toggleTheme } = useTheme();
    const { isPassphraseEnabled, togglePassphrase } = usePassphrase();
    const [isAdminEnabled, setIsAdminEnabled] = useState(false);
    const [isDnsEnabled, setIsDnsEnabled] = useState(false);
    const [canOverlay, setCanOverlay] = useState(true);

    // Live status
    const [accessibilityOn, setAccessibilityOn] = useState(false);
    const [watchdogOn, setWatchdogOn] = useState(false);
    const [dnsRuleCount, setDnsRuleCount] = useState(0);
    const [dnsStats, setDnsStats] = useState<DnsStats | null>(null);

    const [showEnablePassphrasePopup, setShowEnablePassphrasePopup] = useState(false);
    const [showDisablePassphrasePopup, setShowDisablePassphrasePopup] = useState(false);
    const [pendingToggleValue, setPendingToggleValue] = useState<boolean | null>(null);

    const [showEnableUninstallPreventionPopup, setShowEnableUninstallPreventionPopup] = useState(false);
    const [showDisableUninstallPreventionPopup, setShowDisableUninstallPreventionPopup] = useState(false);
    const [showPassphraseUninstallPreventionPopup, setShowPassphraseUninstallPreventionPopup] = useState(false);

    const [wizardVisible, setWizardVisible] = useState(false);
    const [showDisableDnsPassphrasePopup, setShowDisableDnsPassphrasePopup] = useState(false);
    const [upstream, setUpstream] = useState('');
    const [showUpstreamPopup, setShowUpstreamPopup] = useState(false);

    const [errorPopupVisible, setErrorPopupVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState(ERRORS.uninstallPrevention.title);
    const [errorText, setErrorText] = useState(ERRORS.uninstallPrevention.text);

    const appState = useRef(AppState.currentState);

    const showError = (title: string, text: string) => {
        setErrorTitle(title);
        setErrorText(text);
        setErrorPopupVisible(true);
    };

    const handleTogglePassphrase = (nextValue: boolean) => {
        setPendingToggleValue(nextValue);
        nextValue ? setShowEnablePassphrasePopup(true) : setShowDisablePassphrasePopup(true);
    };

    const handleToggleUninstallPrevention = (nextValue: boolean) => {
        nextValue ? setShowEnableUninstallPreventionPopup(true) : setShowDisableUninstallPreventionPopup(true);
    };

    const handleToggleDns = async (nextValue: boolean) => {
        if (nextValue) {
            setWizardVisible(true); // guided setup turns it on
        } else if (isPassphraseEnabled) {
            // Weakening protection — require the passphrase first.
            setShowDisableDnsPassphrasePopup(true);
        } else {
            setIsDnsEnabled(false);
            await disableDnsBlocking();
        }
    };

    const confirmDisableDns = async () => {
        setShowDisableDnsPassphrasePopup(false);
        setIsDnsEnabled(false);
        await disableDnsBlocking();
    };

    const confirmPassphrasePopup = (action: 'enable' | 'disable') => {
        if (action === 'enable') {
            setShowEnablePassphrasePopup(false);
        } else {
            setShowDisablePassphrasePopup(false);
        }
        setPendingToggleValue(null);
        togglePassphrase();
    };

    const cancelPassphrasePopup = (action: 'enable' | 'disable') => {
        if (action === 'enable') {
            setShowEnablePassphrasePopup(false);
        } else {
            setShowDisablePassphrasePopup(false);
        }
        setPendingToggleValue(null);
    };

    const confirmUninstallPreventionChange = async () => {
        try {
            const result = await toggleDeviceAdmin();
            if (result === false) {
                setIsAdminEnabled(false);
            }
        } catch (err) {
            showError(ERRORS.uninstallPrevention.title, ERRORS.uninstallPrevention.text);
        }
    };

    const confirmEnableUninstallPrevention = async () => {
        setShowEnableUninstallPreventionPopup(false);
        await confirmUninstallPreventionChange();
    };

    const confirmDisableUninstallPrevention = async () => {
        if (isPassphraseEnabled) {
            setShowPassphraseUninstallPreventionPopup(true);
            setShowDisableUninstallPreventionPopup(false);
        } else {
            setShowDisableUninstallPreventionPopup(false);
            await confirmUninstallPreventionChange();
        }
    };

    const confirmPassphraseUninstallPrevention = async () => {
        await confirmUninstallPreventionChange();
        setShowPassphraseUninstallPreventionPopup(false);
    };

    const refreshStatus = async () => {
        const [admin, dns, overlay, access, stats, sites, up, wd] = await Promise.all([
            checkAdmin(),
            isDnsBlockingRunning(),
            canDrawOverlays(),
            checkAccessibilityEnabled(),
            getDnsStats(),
            getBlockedWebsites().catch(() => []),
            getUpstreamDns(),
            isWatchdogRunning(),
        ]);
        setIsAdminEnabled(admin);
        setIsDnsEnabled(dns);
        setCanOverlay(overlay);
        setAccessibilityOn(access);
        setDnsStats(stats);
        setDnsRuleCount(sites.filter(s => s.days === 'Full Week' && s.time === 'All Day Long').length);
        setUpstream(up);
        setWatchdogOn(wd);
    };

    const upstreamLabel = (value: string) => {
        if (!value) return 'System default';
        if (value === ADGUARD_DNS) return 'AdGuard (ads & trackers)';
        return value;
    };

    const pickUpstream = async (ip: string) => {
        setShowUpstreamPopup(false);
        setUpstream(ip);
        await setUpstreamDns(ip);
        setTimeout(refreshStatus, 1200); // filter restarts (~0.7s) to apply
    };

    useEffect(() => {
        refreshStatus();

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                refreshStatus();
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

    return (
        <BaseScreen title="Settings Screen">
            {/* ---- Live protection status ---- */}
            <ThemedView withBorder style={styles.statusCard}>
                <ThemedText weight="strong" size="large" style={styles.statusTitle}>
                    Protection status
                </ThemedText>
                <StatusRow label="Accessibility blocking" value={accessibilityOn ? 'ON' : 'OFF'} ok={accessibilityOn} />
                <StatusRow label="Re-enable watchdog" value={watchdogOn ? 'Running' : 'Off'} ok={watchdogOn} />
                <StatusRow label="Display over other apps" value={canOverlay ? 'Granted' : 'Needed'} ok={canOverlay} />
                <StatusRow label="DNS filter (VPN)" value={isDnsEnabled ? 'Running' : 'Off'} ok={isDnsEnabled} />
                <StatusRow label="Sites covered by DNS" value={`${dnsRuleCount}`} ok={dnsRuleCount > 0} />
                {dnsStats && isDnsEnabled && (
                    <>
                        <StatusRow
                            label="DNS seen / blocked / errors"
                            value={`${dnsStats.forwarded} / ${dnsStats.blocked} / ${dnsStats.errors}`}
                            ok={dnsStats.errors === 0}
                        />
                        {dnsStats.forwarded === 0 && dnsStats.blocked === 0 && (
                            <ThemedText size="small" color="primaryRed" style={styles.statusHint}>
                                DNS is on but sees no queries — Private DNS (encrypted) is likely on. Turn it off via the
                                DNS Blocking setup.
                            </ThemedText>
                        )}
                    </>
                )}
                <Pressable style={styles.testBtn} onPress={() => testWatchdogWarning()}>
                    <ThemedText size="small" weight="strong" color="primaryBlue" align="center">
                        Test the “turn protection back on” screen
                    </ThemedText>
                </Pressable>
            </ThemedView>

            <ThemedView color="background" style={styles.settingItem}>
                <ThemedText>Dark Mode</ThemedText>
                <Switch
                    value={isDarkMode}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={isDarkMode ? '#3b82f6' : '#c0c0c0'}
                />
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />
            <ThemedView color="background" style={styles.settingItem}>
                <ThemedText>Passphrase Protection</ThemedText>
                <Switch
                    value={pendingToggleValue ?? isPassphraseEnabled}
                    onValueChange={handleTogglePassphrase}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={pendingToggleValue ?? isPassphraseEnabled ? '#3b82f6' : '#c0c0c0'}
                />
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />
            <ThemedView color="background" style={styles.settingItem}>
                <ThemedText>Uninstall Prevention</ThemedText>
                <Switch
                    value={isAdminEnabled}
                    onValueChange={handleToggleUninstallPrevention}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={isAdminEnabled ? '#3b82f6' : '#c0c0c0'}
                />
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />
            <ThemedView color="background" style={styles.settingItem}>
                <View style={styles.settingLabelContainer}>
                    <ThemedText>DNS Blocking</ThemedText>
                    <Pressable onPress={() => setWizardVisible(true)}>
                        <ThemedText size="small" color="primaryBlue">
                            {isDnsEnabled ? 'Re-run guided setup' : 'Guided setup — tap the switch'}
                        </ThemedText>
                    </Pressable>
                </View>
                <Switch
                    value={isDnsEnabled}
                    onValueChange={handleToggleDns}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={isDnsEnabled ? '#3b82f6' : '#c0c0c0'}
                />
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />
            <ThemedView color="background" style={styles.settingItem}>
                <View style={styles.settingLabelContainer}>
                    <ThemedText>Allowed-sites resolver</ThemedText>
                    <ThemedText size="small" opacity="faded">
                        {upstreamLabel(upstream)}
                    </ThemedText>
                </View>
                <Pressable onPress={() => setShowUpstreamPopup(true)}>
                    <Icon name={'Next'} opacity="faded" style={styles.hideIcon} />
                </Pressable>
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />
            <ThemedView color="background" style={styles.settingItem}>
                <View style={styles.settingLabelContainer}>
                    <ThemedText>Display Over Other Apps</ThemedText>
                    <ThemedText size="small" color={canOverlay ? undefined : 'primaryRed'} opacity={canOverlay ? 'faded' : undefined}>
                        {canOverlay
                            ? 'Granted — the disable warning can appear'
                            : 'Required so the warning shows when a layer is turned off'}
                    </ThemedText>
                </View>
                {canOverlay ? (
                    <Icon name={'Selected'} tint={false} size={28} />
                ) : (
                    <Pressable onPress={() => requestOverlay()}>
                        <Icon name={'Next'} opacity="faded" style={styles.hideIcon} />
                    </Pressable>
                )}
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />
            <ThemedView color="background" style={styles.settingItem}>
                <ThemedText>Navigate to Accessibility settings</ThemedText>
                <Pressable onPress={() => openAccessibilitySettings()}>
                    <Icon name={'Next'} opacity="faded" style={styles.hideIcon} />
                </Pressable>
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />

            <PopUp
                visible={showEnablePassphrasePopup}
                title={PASSPHRASE_PROTECTION.title}
                text={PASSPHRASE_PROTECTION.text}
                onClose={() => cancelPassphrasePopup('enable')}
                onConfirm={() => confirmPassphrasePopup('enable')}
            />
            <PassphrasePopup
                visible={showDisablePassphrasePopup}
                onClose={() => cancelPassphrasePopup('disable')}
                onConfirm={() => confirmPassphrasePopup('disable')}
            />

            <PopUp
                visible={showEnableUninstallPreventionPopup}
                title={UNINSTALL_PREVENTION.enable.title}
                text={UNINSTALL_PREVENTION.enable.text}
                onClose={() => setShowEnableUninstallPreventionPopup(false)}
                onConfirm={confirmEnableUninstallPrevention}
            />
            <PopUp
                visible={showDisableUninstallPreventionPopup}
                title={UNINSTALL_PREVENTION.disable.title}
                text={UNINSTALL_PREVENTION.disable.text}
                onClose={() => setShowDisableUninstallPreventionPopup(false)}
                onConfirm={confirmDisableUninstallPrevention}
            />
            <PassphrasePopup
                visible={showPassphraseUninstallPreventionPopup}
                onClose={() => setShowPassphraseUninstallPreventionPopup(false)}
                onConfirm={confirmPassphraseUninstallPrevention}
            />

            <BlurModal visible={showUpstreamPopup} onClose={() => setShowUpstreamPopup(false)}>
                <ThemedText weight="strong" size="large" align="center">
                    Resolver for allowed sites
                </ThemedText>
                <ThemedText size="small" align="center" style={styles.upstreamIntro}>
                    Your blocked sites are always blocked. Everything else is resolved by:
                </ThemedText>
                <Pressable style={styles.optionBtn} onPress={() => pickUpstream('')}>
                    <ThemedText weight={upstream === '' ? 'strong' : 'medium'} color={upstream === '' ? 'primaryBlue' : undefined}>
                        System default
                    </ThemedText>
                </Pressable>
                <Pressable style={styles.optionBtn} onPress={() => pickUpstream(ADGUARD_DNS)}>
                    <ThemedText
                        weight={upstream === ADGUARD_DNS ? 'strong' : 'medium'}
                        color={upstream === ADGUARD_DNS ? 'primaryBlue' : undefined}>
                        AdGuard — keep ad & tracker blocking
                    </ThemedText>
                    <ThemedText size="small" opacity="faded">
                        94.140.14.14 · keep Private DNS OFF
                    </ThemedText>
                </Pressable>
                <View style={styles.popupButtonsContainer}>
                    <ActionButton variant="cancel" onPress={() => setShowUpstreamPopup(false)} />
                </View>
            </BlurModal>

            <PassphrasePopup
                visible={showDisableDnsPassphrasePopup}
                onClose={() => setShowDisableDnsPassphrasePopup(false)}
                onConfirm={confirmDisableDns}
            />

            <DnsSetupWizard
                visible={wizardVisible}
                onClose={() => {
                    setWizardVisible(false);
                    refreshStatus();
                }}
                onDnsEnabledChange={setIsDnsEnabled}
            />

            <ErrorPopup
                title={errorTitle}
                text={errorText}
                visible={errorPopupVisible}
                onClose={() => setErrorPopupVisible(false)}
            />
        </BaseScreen>
    );
};

interface StatusRowProps {
    label: string;
    value: string;
    ok: boolean;
}

const StatusRow: React.FC<StatusRowProps> = ({ label, value, ok }) => (
    <View style={styles.statusRow}>
        <ThemedText size="small">{label}</ThemedText>
        <ThemedText size="small" weight="strong" color={ok ? 'primaryBlue' : 'primaryRed'}>
            {value}
        </ThemedText>
    </View>
);

interface PopUpProps {
    visible: boolean;
    title: string;
    text: string;
    onClose: () => void;
    onConfirm: () => void;
}

const PopUp: React.FC<PopUpProps> = ({ visible, onClose, onConfirm, title, text }) => {
    return (
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText weight="medium" align="center">
                {title}
                <ThemedText size="small">{text}</ThemedText>
            </ThemedText>
            <View style={styles.popupButtonsContainer}>
                <ActionButton variant="cancel" onPress={onClose} />
                <ActionButton variant="confirm" onPress={onConfirm} />
            </View>
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
    },
    settingLabelContainer: {
        flex: 1,
        paddingRight: spacing.md,
    },
    statusCard: {
        margin: spacing.sm,
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusTitle: {
        marginBottom: spacing.sm,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    statusHint: {
        marginTop: spacing.xs,
    },
    testBtn: {
        marginTop: spacing.sm,
        paddingVertical: spacing.xs,
    },
    upstreamIntro: {
        marginVertical: spacing.sm,
    },
    optionBtn: {
        borderWidth: 1,
        borderColor: '#1976D2',
        borderRadius: 12,
        padding: spacing.md,
        marginTop: spacing.sm,
    },
    popupButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.lg,
    },
    divideContainer: {
        height: 1,
    },
    hideIcon: {
        marginRight: spacing.sm,
    },
});

export default SettingsScreen;

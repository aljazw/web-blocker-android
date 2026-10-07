import { AppState, AppStateStatus, ScrollView, StyleSheet, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import { Pressable, Switch } from 'react-native-gesture-handler';
import { useEffect, useRef, useState } from 'react';
import { ACCENTS, AccentName, shapes, spacing } from '../theme';
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
import SectionHeader from '../components/SectionHeader';
import { AnimatedBar, FadeIn } from '../components/Motion';
import { haptics } from '../utils/haptics';

const SettingsScreen: React.FC = () => {
    const { theme, isDarkMode, toggleTheme, accent, setAccent } = useTheme();
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

    const layers = [
        { label: 'Accessibility blocking', value: accessibilityOn ? 'On' : 'Off', ok: accessibilityOn },
        { label: 'Re-enable watchdog', value: watchdogOn ? 'Running' : 'Off', ok: watchdogOn },
        { label: 'Display over other apps', value: canOverlay ? 'Granted' : 'Needed', ok: canOverlay },
        { label: 'DNS filter (VPN)', value: isDnsEnabled ? 'Running' : 'Off', ok: isDnsEnabled },
        { label: 'Uninstall prevention', value: isAdminEnabled ? 'On' : 'Off', ok: isAdminEnabled },
    ];
    const layersOn = layers.filter(l => l.ok).length;

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
        <BaseScreen title="Settings" subtitle="Protection, security and appearance">
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* ---- Live protection status ---- */}
                <FadeIn>
                    <ThemedView withBorder style={styles.statusCard}>
                        <View style={styles.statusHeader}>
                            <View style={styles.flex}>
                                <ThemedText weight="strong" size="large">
                                    Protection health
                                </ThemedText>
                                <ThemedText size="small" color="muted">
                                    {layersOn} of {layers.length} layers active
                                </ThemedText>
                            </View>
                            <View
                                style={[
                                    styles.healthBadge,
                                    {
                                        backgroundColor: accessibilityOn
                                            ? theme.colors.accentSoft
                                            : 'rgba(255,107,107,0.16)',
                                    },
                                ]}>
                                <ThemedText
                                    size="small"
                                    weight="strong"
                                    style={{ color: accessibilityOn ? theme.colors.accent : theme.colors.primaryRed }}>
                                    {accessibilityOn ? (layersOn === layers.length ? 'Strong' : 'Good') : 'At risk'}
                                </ThemedText>
                            </View>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: theme.colors.elevated }]}>
                            <AnimatedBar
                                fraction={layersOn / layers.length}
                                color={accessibilityOn ? theme.colors.accent : theme.colors.primaryRed}
                                style={styles.progressFill}
                            />
                        </View>
                        {layers.map(layer => (
                            <StatusRow key={layer.label} label={layer.label} value={layer.value} ok={layer.ok} />
                        ))}
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
                                        DNS is on but sees no queries — Private DNS (encrypted) is likely on. Turn it
                                        off via the DNS Blocking setup.
                                    </ThemedText>
                                )}
                            </>
                        )}
                        <Pressable
                            style={[styles.testBtn, { backgroundColor: theme.colors.elevated }]}
                            onPress={() => testWatchdogWarning()}>
                            <ThemedText size="small" weight="strong" color="accent" align="center">
                                Test the “turn protection back on” screen
                            </ThemedText>
                        </Pressable>
                    </ThemedView>
                </FadeIn>

                {/* ---- Appearance ---- */}
                <FadeIn delay={70}>
                    <SectionHeader title="Appearance" />
                    <ThemedView withBorder style={styles.group}>
                        <SettingRow icon="Moon" title="Dark mode" description="Easier on the eyes at night">
                            <ThemedSwitch value={isDarkMode} onValueChange={toggleTheme} />
                        </SettingRow>
                        <Divider />
                        <View style={styles.row}>
                            <View style={[styles.rowIcon, { backgroundColor: theme.colors.accentSoft }]}>
                                <Icon name="Palette" size={18} tint={theme.colors.accent} />
                            </View>
                            <View style={styles.flex}>
                                <ThemedText weight="medium">Accent color</ThemedText>
                                <ThemedText size="small" color="muted">
                                    {ACCENTS[accent].label}
                                </ThemedText>
                            </View>
                        </View>
                        <View style={styles.swatches}>
                            {(Object.keys(ACCENTS) as AccentName[]).map(name => {
                                const color = isDarkMode ? ACCENTS[name].dark : ACCENTS[name].light;
                                const selected = name === accent;
                                return (
                                    <Pressable
                                        key={name}
                                        accessibilityLabel={`${ACCENTS[name].label} accent`}
                                        onPress={() => {
                                            haptics.tap();
                                            setAccent(name);
                                        }}
                                        style={[styles.swatchRing, { borderColor: selected ? color : 'transparent' }]}>
                                        <View style={[styles.swatch, { backgroundColor: color }]} />
                                    </Pressable>
                                );
                            })}
                        </View>
                    </ThemedView>
                </FadeIn>

                {/* ---- Security ---- */}
                <FadeIn delay={140}>
                    <SectionHeader title="Security" />
                    <ThemedView withBorder style={styles.group}>
                        <SettingRow
                            icon="Key"
                            title="Passphrase protection"
                            description="Require a long passphrase to weaken protection">
                            <ThemedSwitch
                                value={pendingToggleValue ?? isPassphraseEnabled}
                                onValueChange={handleTogglePassphrase}
                            />
                        </SettingRow>
                        <Divider />
                        <SettingRow
                            icon="Shield"
                            title="Uninstall prevention"
                            description="Stops SiteLock being removed on impulse">
                            <ThemedSwitch value={isAdminEnabled} onValueChange={handleToggleUninstallPrevention} />
                        </SettingRow>
                    </ThemedView>
                </FadeIn>

                {/* ---- Network filter ---- */}
                <FadeIn delay={210}>
                    <SectionHeader title="Network filter" />
                    <ThemedView withBorder style={styles.group}>
                        <SettingRow
                            icon="Globe"
                            title="DNS blocking"
                            description={isDnsEnabled ? 'Re-run guided setup' : 'Guided setup — tap the switch'}
                            onDescriptionPress={() => setWizardVisible(true)}>
                            <ThemedSwitch value={isDnsEnabled} onValueChange={handleToggleDns} />
                        </SettingRow>
                        <Divider />
                        <SettingRow
                            icon="Server"
                            title="Allowed-sites resolver"
                            description={upstreamLabel(upstream)}
                            onPress={() => setShowUpstreamPopup(true)}>
                            <Chevron />
                        </SettingRow>
                    </ThemedView>
                </FadeIn>

                {/* ---- Permissions ---- */}
                <FadeIn delay={280}>
                    <SectionHeader title="Permissions" />
                    <ThemedView withBorder style={styles.group}>
                        <SettingRow
                            icon="Layers"
                            title="Display over other apps"
                            description={
                                canOverlay
                                    ? 'Granted — the disable warning can appear'
                                    : 'Required so the warning shows when a layer is turned off'
                            }
                            danger={!canOverlay}
                            onPress={canOverlay ? undefined : () => requestOverlay()}>
                            {canOverlay ? <Icon name={'Selected'} tint={false} size={24} /> : <Chevron />}
                        </SettingRow>
                        <Divider />
                        <SettingRow
                            icon="Accessibility"
                            title="Accessibility settings"
                            description="Where the SiteLock blocking service is switched on"
                            onPress={() => openAccessibilitySettings()}>
                            <Chevron />
                        </SettingRow>
                    </ThemedView>
                </FadeIn>

                <ThemedText size="tiny" color="muted" align="center" style={styles.footer}>
                    SiteLock · all blocking runs on your device
                </ThemedText>
            </ScrollView>

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
                <Pressable
                    style={[
                        styles.optionBtn,
                        { borderColor: upstream === '' ? theme.colors.accent : theme.colors.border },
                    ]}
                    onPress={() => pickUpstream('')}>
                    <ThemedText
                        weight={upstream === '' ? 'strong' : 'medium'}
                        color={upstream === '' ? 'accent' : undefined}>
                        System default
                    </ThemedText>
                </Pressable>
                <Pressable
                    style={[
                        styles.optionBtn,
                        { borderColor: upstream === ADGUARD_DNS ? theme.colors.accent : theme.colors.border },
                    ]}
                    onPress={() => pickUpstream(ADGUARD_DNS)}>
                    <ThemedText
                        weight={upstream === ADGUARD_DNS ? 'strong' : 'medium'}
                        color={upstream === ADGUARD_DNS ? 'accent' : undefined}>
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

const StatusRow: React.FC<StatusRowProps> = ({ label, value, ok }) => {
    const { theme } = useTheme();
    const color = ok ? theme.colors.primaryGreen : theme.colors.primaryRed;
    return (
        <View style={styles.statusRow}>
            <View style={styles.statusLabel}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <ThemedText size="small">{label}</ThemedText>
            </View>
            <ThemedText size="small" weight="strong" style={{ color }}>
                {value}
            </ThemedText>
        </View>
    );
};

interface SettingRowProps {
    icon?: string;
    title: string;
    description?: string;
    danger?: boolean;
    onPress?: () => void;
    onDescriptionPress?: () => void;
    children?: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({
    icon,
    title,
    description,
    danger,
    onPress,
    onDescriptionPress,
    children,
}) => {
    const { theme } = useTheme();
    const content = (
        <View style={styles.row}>
            {icon && (
                <View style={[styles.rowIcon, { backgroundColor: theme.colors.accentSoft }]}>
                    <Icon name={icon} size={18} tint={theme.colors.accent} />
                </View>
            )}
            <View style={styles.rowText}>
                <ThemedText weight="medium">{title}</ThemedText>
                {description &&
                    (onDescriptionPress ? (
                        <Pressable onPress={onDescriptionPress} hitSlop={6}>
                            <ThemedText size="small" color="accent" weight="medium">
                                {description}
                            </ThemedText>
                        </Pressable>
                    ) : (
                        <ThemedText
                            size="small"
                            style={{ color: danger ? theme.colors.primaryRed : theme.colors.muted }}>
                            {description}
                        </ThemedText>
                    ))}
            </View>
            {children}
        </View>
    );
    return onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: theme.colors.elevated }}>
            {content}
        </Pressable>
    ) : (
        content
    );
};

const ThemedSwitch: React.FC<{ value: boolean; onValueChange: (v: boolean) => void }> = ({ value, onValueChange }) => {
    const { theme } = useTheme();
    return (
        <Switch
            value={value}
            onValueChange={v => {
                haptics.toggle();
                onValueChange(v);
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor="#FFFFFF"
        />
    );
};

const Chevron: React.FC = () => {
    const { theme } = useTheme();
    return <Icon name={'Next'} size={16} tint={theme.colors.muted} />;
};

const Divider: React.FC = () => {
    const { theme } = useTheme();
    return <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />;
};

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
                <ThemedText size="small" color="muted">
                    {text}
                </ThemedText>
            </ThemedText>
            <View style={styles.popupButtonsContainer}>
                <ActionButton variant="cancel" onPress={onClose} />
                <ActionButton variant="confirm" onPress={onConfirm} />
            </View>
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
        paddingBottom: spacing.xl,
    },
    flex: {
        flex: 1,
    },
    statusCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        padding: spacing.md,
        borderRadius: shapes.borderRadius.large,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    healthBadge: {
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 5,
        borderRadius: shapes.borderRadius.pill,
    },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
    },
    statusLabel: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: spacing.sm,
    },
    statusHint: {
        marginTop: spacing.xs,
    },
    testBtn: {
        marginTop: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderRadius: shapes.borderRadius.pill,
    },
    group: {
        marginHorizontal: spacing.md,
        borderRadius: shapes.borderRadius.large,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
    },
    rowIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm + 2,
    },
    rowText: {
        flex: 1,
        paddingRight: spacing.md,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: spacing.md + 34 + spacing.sm + 2,
    },
    swatches: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingLeft: spacing.md + 34 + spacing.sm - 2,
        paddingRight: spacing.md,
        paddingBottom: spacing.md,
    },
    swatchRing: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
    },
    swatch: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    upstreamIntro: {
        marginVertical: spacing.sm,
    },
    optionBtn: {
        alignSelf: 'stretch',
        borderWidth: 1,
        borderRadius: shapes.borderRadius.medium,
        padding: spacing.md,
        marginTop: spacing.sm,
    },
    popupButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.lg,
    },
    footer: {
        marginTop: spacing.xl,
    },
});

export default SettingsScreen;

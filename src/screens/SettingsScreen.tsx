import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import React, { useState } from 'react';
import BaseScreen from '../components/BaseScreen';
import { ACCENTS, AccentName, shapes, spacing } from '../theme';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import BlurModal from '../components/BlurModal';
import ActionButton from '../components/ActionButton';
import PassphrasePopup from '../components/PassphrasePopup';
import ErrorPopup from '../components/ErrorPopup';
import Icon from '../components/Icon';
import DnsSetupWizard from '../components/DnsSetupWizard';
import SectionHeader from '../components/SectionHeader';
import { AnimatedBar, FadeIn } from '../components/Motion';
import { usePassphrase } from '../context/PassphraseContext';
import { useTheme } from '../context/ThemeContext';
import { useProtectionStatus } from '../hooks/useProtectionStatus';
import { toggleDeviceAdmin } from '../utils/deviceAdmin';
import { openAccessibilitySettings } from '../utils/accessibility';
import { ADGUARD_DNS, disableDnsBlocking, setUpstreamDns } from '../utils/dnsBlocking';
import { requestOverlay } from '../utils/overlay';
import { testWatchdogWarning } from '../utils/watchdog';
import { haptics } from '../utils/haptics';
import { ERRORS, PASSPHRASE_PROTECTION, UNINSTALL_PREVENTION } from '../constants/strings';

/**
 * Exactly one popup can be open at a time, so the screen can never end up
 * with two dialogs stacked or a dialog stuck open.
 */
type Dialog =
    | { kind: 'confirm'; title: string; text: string; onConfirm: () => void | Promise<void> }
    | { kind: 'passphrase'; onConfirm: () => void | Promise<void> }
    | { kind: 'upstream' }
    | { kind: 'dnsWizard' }
    | { kind: 'error'; title: string; text: string };

const upstreamLabel = (value: string) => {
    if (!value) return 'System default';
    if (value === ADGUARD_DNS) return 'AdGuard (ads & trackers)';
    return value;
};

const SettingsScreen: React.FC = () => {
    const { theme, isDarkMode, toggleTheme, accent, setAccent } = useTheme();
    const { isPassphraseEnabled, togglePassphrase } = usePassphrase();
    const { status, refresh, patch } = useProtectionStatus();
    const [dialog, setDialog] = useState<Dialog | null>(null);

    const close = () => setDialog(null);

    /** Runs `action` right away, or after the passphrase when passphrase protection is on. */
    const guarded = (action: () => void | Promise<void>) => {
        if (isPassphraseEnabled) {
            setDialog({ kind: 'passphrase', onConfirm: action });
        } else {
            close();
            return action();
        }
    };

    // ---- Actions ---------------------------------------------------------

    const changeUninstallPrevention = async () => {
        try {
            await toggleDeviceAdmin();
        } catch {
            setDialog({ kind: 'error', ...ERRORS.uninstallPrevention });
        }
        // The system dialog returns to the app; useProtectionStatus refreshes then.
    };

    const turnOffDns = async () => {
        patch({ dns: false });
        await disableDnsBlocking();
        refresh();
    };

    const pickUpstream = async (ip: string) => {
        close();
        patch({ upstream: ip });
        await setUpstreamDns(ip);
        setTimeout(refresh, 1200); // the filter restarts (~0.7s) to apply it
    };

    // ---- Switch handlers -------------------------------------------------

    const onPassphraseSwitch = (enable: boolean) =>
        enable
            ? setDialog({
                  kind: 'confirm',
                  ...PASSPHRASE_PROTECTION,
                  onConfirm: () => {
                      close();
                      togglePassphrase();
                  },
              })
            : guarded(togglePassphrase);

    const onUninstallSwitch = (enable: boolean) =>
        setDialog({
            kind: 'confirm',
            ...(enable ? UNINSTALL_PREVENTION.enable : UNINSTALL_PREVENTION.disable),
            // Turning protection on needs no passphrase; turning it off does.
            onConfirm: enable
                ? () => {
                      close();
                      return changeUninstallPrevention();
                  }
                : () => guarded(changeUninstallPrevention),
        });

    const onDnsSwitch = (enable: boolean) => (enable ? setDialog({ kind: 'dnsWizard' }) : guarded(turnOffDns));

    // ---- Derived ---------------------------------------------------------

    const layers = [
        { label: 'Accessibility blocking', value: status.accessibility ? 'On' : 'Off', ok: status.accessibility },
        { label: 'Re-enable watchdog', value: status.watchdog ? 'Running' : 'Off', ok: status.watchdog },
        { label: 'Display over other apps', value: status.overlay ? 'Granted' : 'Needed', ok: status.overlay },
        { label: 'DNS filter (VPN)', value: status.dns ? 'Running' : 'Off', ok: status.dns },
        { label: 'Uninstall prevention', value: status.admin ? 'On' : 'Off', ok: status.admin },
    ];
    const layersOn = layers.filter(l => l.ok).length;

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
                                        backgroundColor: status.accessibility
                                            ? theme.colors.accentSoft
                                            : 'rgba(255,107,107,0.16)',
                                    },
                                ]}>
                                <ThemedText
                                    size="small"
                                    weight="strong"
                                    style={{
                                        color: status.accessibility ? theme.colors.accent : theme.colors.primaryRed,
                                    }}>
                                    {status.accessibility
                                        ? layersOn === layers.length
                                            ? 'Strong'
                                            : 'Good'
                                        : 'At risk'}
                                </ThemedText>
                            </View>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: theme.colors.elevated }]}>
                            <AnimatedBar
                                fraction={layersOn / layers.length}
                                color={status.accessibility ? theme.colors.accent : theme.colors.primaryRed}
                                style={styles.progressFill}
                            />
                        </View>
                        {layers.map(layer => (
                            <StatusRow key={layer.label} label={layer.label} value={layer.value} ok={layer.ok} />
                        ))}
                        <StatusRow
                            label="Sites covered by DNS"
                            value={`${status.dnsRuleCount}`}
                            ok={status.dnsRuleCount > 0}
                        />
                        {status.dnsStats && status.dns && (
                            <>
                                <StatusRow
                                    label="DNS seen / blocked / errors"
                                    value={`${status.dnsStats.forwarded} / ${status.dnsStats.blocked} / ${status.dnsStats.errors}`}
                                    ok={status.dnsStats.errors === 0}
                                />
                                {status.dnsStats.forwarded === 0 && status.dnsStats.blocked === 0 && (
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
                            <ThemedSwitch value={isPassphraseEnabled} onValueChange={onPassphraseSwitch} />
                        </SettingRow>
                        <Divider />
                        <SettingRow
                            icon="Shield"
                            title="Uninstall prevention"
                            description="Stops SiteLock being removed on impulse">
                            <ThemedSwitch value={status.admin} onValueChange={onUninstallSwitch} />
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
                            description={status.dns ? 'Re-run guided setup' : 'Guided setup — tap the switch'}
                            onDescriptionPress={() => setDialog({ kind: 'dnsWizard' })}>
                            <ThemedSwitch value={status.dns} onValueChange={onDnsSwitch} />
                        </SettingRow>
                        <Divider />
                        <SettingRow
                            icon="Server"
                            title="Allowed-sites resolver"
                            description={upstreamLabel(status.upstream)}
                            onPress={() => setDialog({ kind: 'upstream' })}>
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
                                status.overlay
                                    ? 'Granted — the disable warning can appear'
                                    : 'Required so the warning shows when a layer is turned off'
                            }
                            danger={!status.overlay}
                            onPress={status.overlay ? undefined : () => requestOverlay()}>
                            {status.overlay ? <Icon name={'Selected'} tint={false} size={24} /> : <Chevron />}
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

            <ConfirmPopup
                visible={dialog?.kind === 'confirm'}
                title={dialog?.kind === 'confirm' ? dialog.title : ''}
                text={dialog?.kind === 'confirm' ? dialog.text : ''}
                onClose={close}
                onConfirm={() => (dialog?.kind === 'confirm' ? dialog.onConfirm() : undefined)}
            />

            <PassphrasePopup
                visible={dialog?.kind === 'passphrase'}
                onClose={close}
                onConfirm={() => {
                    if (dialog?.kind !== 'passphrase') return;
                    const action = dialog.onConfirm;
                    close();
                    action();
                }}
            />

            <BlurModal visible={dialog?.kind === 'upstream'} onClose={close}>
                <ThemedText weight="strong" size="large" align="center">
                    Resolver for allowed sites
                </ThemedText>
                <ThemedText size="small" align="center" style={styles.upstreamIntro}>
                    Your blocked sites are always blocked. Everything else is resolved by:
                </ThemedText>
                <UpstreamOption
                    title="System default"
                    selected={status.upstream === ''}
                    onPress={() => pickUpstream('')}
                />
                <UpstreamOption
                    title="AdGuard — keep ad & tracker blocking"
                    subtitle={`${ADGUARD_DNS} · keep Private DNS OFF`}
                    selected={status.upstream === ADGUARD_DNS}
                    onPress={() => pickUpstream(ADGUARD_DNS)}
                />
                <View style={styles.popupButtonsContainer}>
                    <ActionButton variant="cancel" onPress={close} />
                </View>
            </BlurModal>

            <DnsSetupWizard
                visible={dialog?.kind === 'dnsWizard'}
                onClose={() => {
                    close();
                    refresh();
                }}
                onDnsEnabledChange={dns => patch({ dns })}
            />

            <ErrorPopup
                title={dialog?.kind === 'error' ? dialog.title : ''}
                text={dialog?.kind === 'error' ? dialog.text : ''}
                visible={dialog?.kind === 'error'}
                onClose={close}
            />
        </BaseScreen>
    );
};

const UpstreamOption: React.FC<{ title: string; subtitle?: string; selected: boolean; onPress: () => void }> = ({
    title,
    subtitle,
    selected,
    onPress,
}) => {
    const { theme } = useTheme();
    return (
        <Pressable
            style={[styles.optionBtn, { borderColor: selected ? theme.colors.accent : theme.colors.border }]}
            onPress={onPress}>
            <ThemedText weight={selected ? 'strong' : 'medium'} color={selected ? 'accent' : undefined}>
                {title}
            </ThemedText>
            {subtitle && (
                <ThemedText size="small" color="muted">
                    {subtitle}
                </ThemedText>
            )}
        </Pressable>
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
            trackColor={{ false: theme.colors.muted, true: theme.colors.accent }}
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

interface ConfirmPopupProps {
    visible: boolean;
    title: string;
    text: string;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
}

const ConfirmPopup: React.FC<ConfirmPopupProps> = ({ visible, onClose, onConfirm, title, text }) => {
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
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
    },
    swatchRing: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
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

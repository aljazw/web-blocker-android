import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import { ACCENTS, AccentName, gutter, shapes, spacing } from '../theme';
import { ThemedText } from '../components/ThemedText';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import PassphrasePopup from '../components/PassphrasePopup';
import ErrorPopup from '../components/ErrorPopup';
import Icon from '../components/Icon';
import DnsSetupWizard from '../components/DnsSetupWizard';
import ProgressBar from '../components/ProgressBar';
import SectionHeader from '../components/SectionHeader';
import { KeyValueRow, ListGroup, ListRow, Toggle } from '../components/ListGroup';
import { FadeIn } from '../components/Motion';
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
import { getSleepSchedule } from '../utils/storage';
import { RootStackNavigation, SleepSchedule } from '../types/types';

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
    if (!value) {
        return 'System default';
    }
    if (value === ADGUARD_DNS) {
        return 'AdGuard (ads & trackers)';
    }
    return value;
};

const SettingsScreen: React.FC = () => {
    const { theme, isDarkMode, toggleTheme, accent, setAccent } = useTheme();
    const { isPassphraseEnabled, togglePassphrase } = usePassphrase();
    const { status, refresh, patch } = useProtectionStatus();
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const navigation = useNavigation<RootStackNavigation>();
    const [sleep, setSleep] = useState<SleepSchedule | null>(null);

    useFocusEffect(
        useCallback(() => {
            getSleepSchedule()
                .then(setSleep)
                .catch(() => setSleep(null));
        }, []),
    );

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

    const health = !status.accessibility ? 'At risk' : layersOn === layers.length ? 'Strong' : 'Good';

    return (
        <BaseScreen title="Settings" subtitle="Protection, security and appearance" headerLeft={<BackButton />}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* ---- Live protection status ---- */}
                <FadeIn>
                    <Card>
                        <View style={styles.statusHeader}>
                            <View style={styles.flex}>
                                <ThemedText weight="strong">Protection health</ThemedText>
                                <ThemedText size="small" color="muted" tabular>
                                    {layersOn} of {layers.length} layers active
                                </ThemedText>
                            </View>
                            <Badge label={health} tone={status.accessibility ? 'success' : 'danger'} dot />
                        </View>
                        <ProgressBar
                            fraction={layersOn / layers.length}
                            color={status.accessibility ? theme.colors.primaryGreen : theme.colors.primaryRed}
                            style={styles.progress}
                        />
                        {layers.map(layer => (
                            <KeyValueRow
                                key={layer.label}
                                label={layer.label}
                                value={layer.value}
                                dot={layer.ok ? theme.colors.primaryGreen : theme.colors.primaryRed}
                                valueColor={layer.ok ? undefined : theme.colors.primaryRed}
                            />
                        ))}
                        <KeyValueRow
                            label="Sites covered by DNS"
                            value={`${status.dnsRuleCount}`}
                            dot={status.dnsRuleCount > 0 ? theme.colors.primaryGreen : theme.colors.border}
                        />
                        {status.dnsStats && status.dns && (
                            <>
                                <KeyValueRow
                                    label="DNS seen / blocked / errors"
                                    value={`${status.dnsStats.forwarded} / ${status.dnsStats.blocked} / ${status.dnsStats.errors}`}
                                    dot={
                                        status.dnsStats.errors === 0
                                            ? theme.colors.primaryGreen
                                            : theme.colors.primaryRed
                                    }
                                />
                                {status.dnsStats.forwarded === 0 && status.dnsStats.blocked === 0 && (
                                    <ThemedText size="small" color="primaryRed" style={styles.statusHint}>
                                        DNS is on but sees no queries. Private DNS (encrypted) is probably on; turn it
                                        off via the DNS blocking setup.
                                    </ThemedText>
                                )}
                            </>
                        )}
                        <Button
                            label="Test the re-enable screen"
                            variant="secondary"
                            compact
                            onPress={() => testWatchdogWarning()}
                            style={styles.testButton}
                        />
                    </Card>
                </FadeIn>

                {/* ---- Sleep ---- */}
                <SectionHeader title="Sleep" />
                <ListGroup>
                    <ListRow
                        icon="Moon"
                        title="Sleep time"
                        description={
                            sleep?.enabled ? `On · ${sleep.bedtime} – ${sleep.wake}` : 'Off · lock your phone at night'
                        }
                        onPress={() => navigation.navigate('Sleep')}
                    />
                </ListGroup>

                {/* ---- Appearance ---- */}
                <SectionHeader title="Appearance" />
                <ListGroup>
                    <ListRow icon="Moon" title="Dark mode" description="Easier on the eyes at night">
                        <Toggle value={isDarkMode} onValueChange={toggleTheme} />
                    </ListRow>
                    <View>
                        <ListRow icon="Palette" title="Accent color" description={ACCENTS[accent].label} />
                        <View style={styles.swatches}>
                            {(Object.keys(ACCENTS) as AccentName[]).map(name => {
                                const color = isDarkMode ? ACCENTS[name].dark : ACCENTS[name].light;
                                const selected = name === accent;
                                return (
                                    <Pressable
                                        key={name}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected }}
                                        accessibilityLabel={`${ACCENTS[name].label} accent`}
                                        onPress={() => {
                                            haptics.tap();
                                            setAccent(name);
                                        }}
                                        style={[styles.swatchRing, selected && { borderColor: color }]}>
                                        <View style={[styles.swatch, { backgroundColor: color }]}>
                                            {selected && (
                                                <Icon name="Check" size={14} tint="#FFFFFF" strokeWidth={2.6} />
                                            )}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </ListGroup>

                {/* ---- Security ---- */}
                <SectionHeader title="Security" />
                <ListGroup>
                    <ListRow
                        icon="Key"
                        title="Passphrase protection"
                        description="Type a long phrase to weaken protection">
                        <Toggle value={isPassphraseEnabled} onValueChange={onPassphraseSwitch} />
                    </ListRow>
                    <ListRow
                        icon="Shield"
                        title="Uninstall prevention"
                        description="Stops Gaman being removed on impulse">
                        <Toggle value={status.admin} onValueChange={onUninstallSwitch} />
                    </ListRow>
                </ListGroup>

                {/* ---- Network filter ---- */}
                <SectionHeader title="Network filter" />
                <ListGroup>
                    <ListRow
                        icon="Globe"
                        title="DNS blocking"
                        description={status.dns ? 'Re-run guided setup' : 'Guided setup: tap the switch'}
                        onDescriptionPress={() => setDialog({ kind: 'dnsWizard' })}>
                        <Toggle value={status.dns} onValueChange={onDnsSwitch} />
                    </ListRow>
                    <ListRow
                        icon="Server"
                        title="Allowed-sites resolver"
                        description={upstreamLabel(status.upstream)}
                        onPress={() => setDialog({ kind: 'upstream' })}
                    />
                </ListGroup>

                {/* ---- Permissions ---- */}
                <SectionHeader title="Permissions" />
                <ListGroup>
                    <ListRow
                        icon="Layers"
                        title="Display over other apps"
                        description={
                            status.overlay
                                ? 'Granted: the re-enable screen can appear'
                                : 'Needed so a warning shows when a layer is turned off'
                        }
                        danger={!status.overlay}
                        onPress={status.overlay ? undefined : () => requestOverlay()}>
                        {status.overlay ? <Icon name="Selected" tint={false} size={20} /> : undefined}
                    </ListRow>
                    <ListRow
                        icon="Accessibility"
                        title="Accessibility settings"
                        description="Where the Gaman blocking service is switched on"
                        onPress={() => openAccessibilitySettings()}
                    />
                </ListGroup>

                <ThemedText size="tiny" color="muted" align="center" style={styles.footer}>
                    Gaman · everything runs on your device
                </ThemedText>
            </ScrollView>

            <Dialog
                visible={dialog?.kind === 'confirm'}
                onClose={close}
                title={dialog?.kind === 'confirm' ? dialog.title : ''}
                message={dialog?.kind === 'confirm' ? dialog.text : ''}
                actions={confirmActions(close, 'Confirm', () =>
                    dialog?.kind === 'confirm' ? dialog.onConfirm() : undefined,
                )}
            />

            <PassphrasePopup
                visible={dialog?.kind === 'passphrase'}
                onClose={close}
                onConfirm={() => {
                    if (dialog?.kind !== 'passphrase') {
                        return;
                    }
                    const action = dialog.onConfirm;
                    close();
                    action();
                }}
            />

            <Dialog
                visible={dialog?.kind === 'upstream'}
                onClose={close}
                icon="Server"
                title="Resolver for allowed sites"
                message="Blocked sites are always blocked. Everything else is resolved by:"
                actions={[{ label: 'Close', onPress: close, variant: 'secondary' }]}>
                <UpstreamOption
                    title="System default"
                    selected={status.upstream === ''}
                    onPress={() => pickUpstream('')}
                />
                <UpstreamOption
                    title="AdGuard: also block ads and trackers"
                    subtitle={`${ADGUARD_DNS} · keep Private DNS off`}
                    selected={status.upstream === ADGUARD_DNS}
                    onPress={() => pickUpstream(ADGUARD_DNS)}
                />
            </Dialog>

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
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
                styles.option,
                { borderColor: theme.colors.border },
                selected && { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
            ]}
            onPress={onPress}>
            <ThemedText weight="medium" color={selected ? 'accent' : 'text'}>
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

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
        paddingBottom: spacing.xl,
    },
    flex: {
        flex: 1,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progress: {
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    statusHint: {
        marginTop: spacing.xs,
    },
    testButton: {
        marginTop: spacing.md,
    },
    swatches: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
    },
    swatchRing: {
        width: 38,
        height: 38,
        borderRadius: shapes.borderRadius.medium,
        borderWidth: 2,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    swatch: {
        width: 28,
        height: 28,
        borderRadius: shapes.borderRadius.small + 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    option: {
        borderWidth: 1,
        borderRadius: shapes.borderRadius.medium,
        padding: spacing.md,
        marginTop: spacing.sm,
    },
    footer: {
        marginTop: spacing.xl,
        marginHorizontal: gutter,
    },
});

export default SettingsScreen;

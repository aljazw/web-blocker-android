import { APP_NAME } from '../constants/brand';
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
import NotesPasswordDialog from '../components/NotesPasswordDialog';
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
import TextField from '../components/TextField';
import {
    ADGUARD_DNS,
    disableDnsBlocking,
    isDnsHostname,
    openPrivateDnsSettings,
    setUpstreamDns,
} from '../utils/dnsBlocking';
import { requestOverlay } from '../utils/overlay';
import { testWatchdogWarning } from '../utils/watchdog';
import { haptics } from '../utils/haptics';
import { ERRORS, PASSPHRASE_PROTECTION, UNINSTALL_PREVENTION } from '../constants/strings';
import {
    Backup,
    backupFileName,
    createBackup,
    describeBackup,
    getSleepSchedule,
    getVacation,
    importBackup,
    parseBackup,
} from '../storage';
import { openBackupFile, saveBackupFile } from '../utils/backupFile';
import { migrateRoutine } from '../utils/planService';
import { isAccentName } from '../theme/accents';
import { RootStackNavigation, SleepSchedule, Vacation } from '../types/types';
import { vacationPhase, vacationRangeLabel } from '../utils/vacation';
import { hasNotesPassword, lockNotes } from '../utils/notes';
import { rescheduleWakeAlarm } from '../utils/wakeAlarm';

/**
 * Exactly one popup can be open at a time, so the screen can never end up
 * with two dialogs stacked or a dialog stuck open.
 */
type Dialog =
    | { kind: 'confirm'; title: string; text: string; onConfirm: () => void | Promise<void> }
    | { kind: 'passphrase'; onConfirm: () => void | Promise<void> }
    | { kind: 'upstream' }
    | { kind: 'dnsWizard' }
    | { kind: 'notesPassword' }
    | { kind: 'info'; title: string; text: string }
    | { kind: 'error'; title: string; text: string };

const errorText = (error: unknown) => (error instanceof Error && error.message ? error.message : 'Please try again.');

const upstreamLabel = (value: string) => {
    if (!value) {
        return 'Automatic · your network’s DNS';
    }
    if (value === ADGUARD_DNS) {
        return 'AdGuard (ads & trackers)';
    }
    return isDnsHostname(value) ? `${value} · encrypted` : value;
};

const SettingsScreen: React.FC = () => {
    const { theme, isDarkMode, toggleTheme, accent, setAccent } = useTheme();
    const { isPassphraseEnabled, togglePassphrase } = usePassphrase();
    const [notesPassword, setNotesPassword] = useState(false);
    const { status, refresh, patch } = useProtectionStatus();
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const navigation = useNavigation<RootStackNavigation>();
    const [sleep, setSleep] = useState<SleepSchedule | null>(null);
    const [vacation, setVacationState] = useState<Vacation | null>(null);
    const [hostDraft, setHostDraft] = useState('');

    const loadBreaks = useCallback(() => {
        getSleepSchedule()
            .then(setSleep)
            .catch(() => setSleep(null));
        getVacation()
            .then(setVacationState)
            .catch(() => setVacationState(null));
        hasNotesPassword()
            .then(setNotesPassword)
            .catch(() => setNotesPassword(false));
    }, []);
    useFocusEffect(loadBreaks);

    const vacationText = () => {
        const phase = vacation ? vacationPhase(vacation) : 'over';
        if (!vacation || phase === 'over') {
            return 'Off · pause every block for a few days';
        }
        return `${phase === 'active' ? 'On' : 'Planned'} · ${vacationRangeLabel(vacation)}`;
    };

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

    const pickUpstream = async (value: string) => {
        close();
        patch({ upstream: value });
        await setUpstreamDns(value);
        refresh();
    };

    const openUpstream = () => {
        const current = status.upstream && isDnsHostname(status.upstream) ? status.upstream : '';
        setHostDraft(current || status.privateDnsHost || '');
        setDialog({ kind: 'upstream' });
    };

    // ---- Backup ------------------------------------------------------------

    const exportData = async () => {
        try {
            const backup = await createBackup();
            if (await saveBackupFile(backupFileName(), JSON.stringify(backup, null, 2))) {
                setDialog({ kind: 'info', title: 'Backup saved', text: describeBackup(backup) });
            }
        } catch (error) {
            setDialog({ kind: 'error', title: 'Couldn’t save the backup', text: errorText(error) });
        }
    };

    const pickImport = async () => {
        let text: string | null;
        try {
            text = await openBackupFile();
        } catch (error) {
            setDialog({ kind: 'error', title: 'Couldn’t open the file', text: errorText(error) });
            return;
        }
        if (!text) {
            return;
        }
        const parsed = parseBackup(text);
        if ('error' in parsed) {
            setDialog({ kind: 'error', title: 'Can’t import this file', text: parsed.error });
            return;
        }
        setDialog({
            kind: 'confirm',
            title: 'Import this backup?',
            text: `${describeBackup(
                parsed.backup,
            )}\n\nYour routine, day plans, workouts, apnea data, notes and appearance on this phone are replaced by the backup. Protected notes open with the notes password they had when exported. Blocked sites and apps are only added: nothing on your block list is removed.`,
            onConfirm: () => applyImport(parsed.backup),
        });
    };

    const applyImport = async (backup: Backup) => {
        close();
        try {
            const result = await importBackup(backup);
            // The notes key may have been replaced: ask for the (backup's) password again.
            lockNotes();
            await migrateRoutine();
            rescheduleWakeAlarm();
            if (backup.data.passphrase === true && !isPassphraseEnabled) {
                togglePassphrase();
            }
            if (isAccentName(backup.data.accent)) {
                setAccent(backup.data.accent);
            }
            if (typeof backup.data.darkMode === 'boolean' && backup.data.darkMode !== isDarkMode) {
                toggleTheme();
            }
            refresh();
            loadBreaks();
            const notes = result.skipped.length ? `\n\n${result.skipped.join('\n')}` : '';
            setDialog({
                kind: result.ok ? 'info' : 'error',
                title: result.ok ? 'Backup imported' : 'Some data couldn’t be imported',
                text: `${describeBackup(backup)}${notes}`,
            });
        } catch (error) {
            setDialog({ kind: 'error', title: 'Import failed', text: errorText(error) });
        }
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
                            </>
                        )}
                        {status.dns && status.privateDnsHost && (
                            <View style={styles.privateDns}>
                                <ThemedText size="small" color="primaryRed">
                                    Private DNS ({status.privateDnsHost}) is on, so the DNS filter is paused and lets
                                    everything through. Your internet keeps working. To filter again, use{' '}
                                    {status.privateDnsHost} inside {APP_NAME}, then set Private DNS to Off.
                                </ThemedText>
                                {status.upstream !== status.privateDnsHost && (
                                    <Button
                                        label={`Use ${status.privateDnsHost} in ${APP_NAME}`}
                                        variant="secondary"
                                        compact
                                        onPress={() => pickUpstream(status.privateDnsHost ?? '')}
                                        style={styles.testButton}
                                    />
                                )}
                                <Button
                                    label="Open Private DNS settings"
                                    variant="secondary"
                                    compact
                                    onPress={() => openPrivateDnsSettings()}
                                    style={styles.statusHint}
                                />
                            </View>
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

                {/* ---- Breaks ---- */}
                <SectionHeader title="Sleep and breaks" />
                <ListGroup>
                    <ListRow
                        icon="Moon"
                        title="Sleep time"
                        description={
                            sleep?.enabled ? `On · ${sleep.bedtime} – ${sleep.wake}` : 'Off · lock your phone at night'
                        }
                        onPress={() => navigation.navigate('Sleep')}
                    />
                    <ListRow
                        icon="Vacation"
                        title="Vacation mode"
                        description={vacationText()}
                        onPress={() => navigation.navigate('Vacation')}
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
                        description={`Stops ${APP_NAME} being removed on impulse`}>
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
                        onPress={openUpstream}
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
                        description={`Where the ${APP_NAME} blocking service is switched on`}
                        onPress={() => openAccessibilitySettings()}
                    />
                </ListGroup>

                {/* ---- Notes ---- */}
                <SectionHeader title="Notes" />
                <ListGroup>
                    <ListRow
                        icon="Lock"
                        title="Notes password"
                        description={
                            notesPassword
                                ? 'Change the password of protected notes'
                                : 'Not set · set one to protect notes'
                        }
                        onPress={() => setDialog({ kind: 'notesPassword' })}
                    />
                </ListGroup>

                {/* ---- Backup ---- */}
                <SectionHeader title="Backup" />
                <ListGroup>
                    <ListRow
                        icon="Download"
                        title="Export data"
                        description="Everything, as one file to move to a new phone. Protected notes stay encrypted"
                        onPress={exportData}
                    />
                    <ListRow
                        icon="Upload"
                        title="Import data"
                        description={`Restore from a ${APP_NAME} backup file`}
                        onPress={pickImport}
                    />
                </ListGroup>

                <ThemedText size="tiny" color="muted" align="center" style={styles.footer}>
                    {APP_NAME} · everything runs on your device
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
                message={`Blocked sites are always blocked. Everything else goes to the resolver below. If it can’t be reached, ${APP_NAME} falls back to your network’s DNS, so the internet keeps working.`}
                actions={[{ label: 'Close', onPress: close, variant: 'secondary' }]}>
                <UpstreamOption
                    title="Automatic"
                    subtitle="The DNS of whatever Wi-Fi or mobile network you’re on"
                    selected={status.upstream === ''}
                    onPress={() => pickUpstream('')}
                />
                <UpstreamOption
                    title="AdGuard: also block ads and trackers"
                    subtitle={ADGUARD_DNS}
                    selected={status.upstream === ADGUARD_DNS}
                    onPress={() => pickUpstream(ADGUARD_DNS)}
                />
                <View
                    style={[
                        styles.option,
                        { borderColor: theme.colors.border },
                        isDnsHostname(status.upstream) && {
                            borderColor: theme.colors.accent,
                            backgroundColor: theme.colors.accentSoft,
                        },
                    ]}>
                    <ThemedText weight="medium" color={isDnsHostname(status.upstream) ? 'accent' : 'text'}>
                        Your Private DNS provider
                    </ThemedText>
                    <ThemedText size="small" color="muted">
                        The hostname from Android’s Private DNS, e.g. a personal AdGuard address. Sent encrypted.
                    </ThemedText>
                    <TextField
                        inset={false}
                        surface="background"
                        value={hostDraft}
                        onChangeText={setHostDraft}
                        placeholder="dns.adguard-dns.com"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        style={styles.hostField}
                    />
                    <Button
                        label="Use this provider"
                        compact
                        disabled={!isDnsHostname(hostDraft)}
                        onPress={() => pickUpstream(hostDraft.trim().toLowerCase())}
                        style={styles.statusHint}
                    />
                </View>
            </Dialog>

            <NotesPasswordDialog
                mode={dialog?.kind === 'notesPassword' ? (notesPassword ? 'change' : 'create') : null}
                onClose={close}
                onDone={() => {
                    setNotesPassword(true);
                    setDialog({
                        kind: 'info',
                        title: notesPassword ? 'Password changed' : 'Password set',
                        text: notesPassword
                            ? 'Protected notes now open with the new password. Backups made before today still need the old one.'
                            : 'Protect a note with the lock button in the note.',
                    });
                }}
            />

            <DnsSetupWizard
                visible={dialog?.kind === 'dnsWizard'}
                onClose={() => {
                    close();
                    refresh();
                }}
                onDnsEnabledChange={dns => patch({ dns })}
            />

            <Dialog
                visible={dialog?.kind === 'info'}
                onClose={close}
                icon="Check"
                tone="success"
                title={dialog?.kind === 'info' ? dialog.title : ''}
                message={dialog?.kind === 'info' ? dialog.text : ''}
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
    privateDns: {
        marginTop: spacing.sm,
    },
    hostField: {
        marginTop: spacing.sm,
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

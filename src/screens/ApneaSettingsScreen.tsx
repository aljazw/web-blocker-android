import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import { ListGroup, ListRow, Toggle } from '../components/ListGroup';
import SafetyRules from '../components/SafetyRules';
import SectionHeader from '../components/SectionHeader';
import Segmented from '../components/Segmented';
import { ThemedText } from '../components/ThemedText';
import { useApneaData } from '../hooks/useApneaData';
import { gutter, spacing } from '../theme';
import { apneaSession } from '../utils/apneaSession';
import { clearApneaRecords } from '../utils/storage';
import { APNEA_SAFETY } from '../constants/apnea';
import { ERRORS } from '../constants/strings';

const BREATHE_UP = [
    { value: '0', label: 'Off' },
    { value: '60', label: '1 min' },
    { value: '120', label: '2 min' },
    { value: '180', label: '3 min' },
];

type Dialog = { kind: 'safety' } | { kind: 'clear' } | { kind: 'error' };

const ApneaSettingsScreen: React.FC = () => {
    const { settings, records, loaded, reload, changeSettings } = useApneaData();
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const close = () => setDialog(null);

    const clearHistory = async () => {
        close();
        if (await clearApneaRecords()) {
            reload();
        } else {
            setDialog({ kind: 'error' });
        }
    };

    return (
        <BaseScreen
            title="Training settings"
            subtitle="Cues, max hold test and data"
            headerLeft={<BackButton />}
            isLoading={!loaded}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <SectionHeader title="Cues" />
                <ListGroup>
                    <ListRow icon="Sound" title="Sound" description="Tones at phase changes and the last 3 seconds">
                        <Toggle value={settings.sound} onValueChange={sound => changeSettings({ sound })} />
                    </ListRow>
                    <ListRow icon="Vibrate" title="Vibration" description="Train with eyes closed, phone face down">
                        <Toggle value={settings.vibration} onValueChange={vibration => changeSettings({ vibration })} />
                    </ListRow>
                    <ListRow
                        icon="Play"
                        title="Test cues"
                        description="Plays the hold cue with the current settings"
                        onPress={() => apneaSession.previewCue('HOLD', settings)}
                    />
                </ListGroup>
                <ThemedText size="small" color="muted" style={styles.footnote}>
                    Sound follows your media volume. Cues keep playing with the screen off.
                </ThemedText>

                <SectionHeader title="Max hold test" />
                <ListGroup>
                    <ListRow
                        icon="Timer"
                        title="Pulse every 30 seconds"
                        description="A soft vibration to track time during the hold">
                        <Toggle value={settings.holdPulse} onValueChange={holdPulse => changeSettings({ holdPulse })} />
                    </ListRow>
                </ListGroup>
                <ThemedText size="tiny" weight="strong" color="muted" caps style={styles.label}>
                    Breathe-up before the hold
                </ThemedText>
                <View style={styles.gutter}>
                    <Segmented
                        options={BREATHE_UP}
                        value={String(settings.breatheUp)}
                        onChange={value => changeSettings({ breatheUp: Number(value) })}
                    />
                </View>

                <SectionHeader title="About" />
                <ListGroup>
                    <ListRow icon="Alert" title="Safety guidelines" onPress={() => setDialog({ kind: 'safety' })} />
                    <ListRow
                        icon="Trash"
                        title="Clear training history"
                        description={`${records.length} session${records.length === 1 ? '' : 's'} stored on this phone`}
                        danger
                        onPress={records.length ? () => setDialog({ kind: 'clear' }) : undefined}
                    />
                </ListGroup>
            </ScrollView>

            <Dialog
                visible={dialog?.kind === 'safety'}
                onClose={close}
                icon="Alert"
                tone="danger"
                title={APNEA_SAFETY.title}
                message={<SafetyRules />}
            />
            <Dialog
                visible={dialog?.kind === 'clear'}
                onClose={close}
                icon="Trash"
                tone="danger"
                title="Clear all training history?"
                message="Every session and personal best will be deleted. This can't be undone."
                actions={confirmActions(close, 'Clear history', clearHistory, true)}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={dialog?.kind === 'error'} onClose={close} />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    flex: {
        flex: 1,
    },
    gutter: {
        marginHorizontal: gutter,
    },
    footnote: {
        marginHorizontal: gutter + 2,
        marginTop: spacing.sm,
    },
    label: {
        marginHorizontal: gutter + 2,
        marginTop: spacing.lg,
        marginBottom: spacing.sm - 2,
    },
});

export default ApneaSettingsScreen;

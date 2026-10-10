import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import Badge from '../components/Badge';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import IconTile from '../components/IconTile';
import PassphrasePopup from '../components/PassphrasePopup';
import RangeCalendar from '../components/RangeCalendar';
import SectionHeader from '../components/SectionHeader';
import { ThemedText } from '../components/ThemedText';
import { gutter, spacing } from '../theme';
import { Vacation } from '../types/types';
import { getVacation, setVacation } from '../storage';
import { fromDateKey, shortDate, toDateKey } from '../utils/dates';
import { vacationDays, vacationPhase, vacationRangeLabel } from '../utils/vacation';
import { haptics } from '../utils/haptics';
import { logger } from '../utils/logger';
import { ERRORS, VACATION_MESSAGES } from '../constants/strings';

type Dialog = { kind: 'passphrase'; next: Vacation } | { kind: 'remove' } | { kind: 'error' };

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

const VacationScreen: React.FC = () => {
    const [saved, setSaved] = useState<Vacation | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [start, setStart] = useState<string | null>(null);
    const [end, setEnd] = useState<string | null>(null);
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const [now, setNow] = useState(() => new Date());
    const close = () => setDialog(null);

    useFocusEffect(
        useCallback(() => {
            setNow(new Date());
            getVacation()
                .then(setSaved)
                .catch(error => logger.warn('Could not load vacation', error))
                .finally(() => setLoaded(true));
        }, []),
    );

    const today = toDateKey(now);
    // A vacation whose last day has passed counts as none.
    const current = saved && vacationPhase(saved, now) !== 'over' ? saved : null;
    const active = current !== null && vacationPhase(current, now) === 'active';
    const picked = start && end ? { start, end } : null;

    const save = async (next: Vacation | null) => {
        close();
        if (await setVacation(next)) {
            haptics.success();
            setSaved(next);
            setStart(null);
            setEnd(null);
        } else {
            setDialog({ kind: 'error' });
        }
    };

    return (
        <BaseScreen
            title="Vacation mode"
            subtitle="Pause every block for the days you choose"
            headerLeft={<BackButton />}
            isLoading={!loaded}>
            <ScrollView contentContainerStyle={styles.scroll}>
                {current ? (
                    <Card>
                        <View style={styles.statusRow}>
                            <IconTile icon="Vacation" tone={active ? 'success' : 'accent'} size={40} />
                            <View style={styles.statusText}>
                                <ThemedText weight="strong" tabular>
                                    {vacationRangeLabel(current, now)}
                                </ThemedText>
                                <ThemedText size="small" color="muted">
                                    {days(vacationDays(current))}
                                </ThemedText>
                            </View>
                            <Badge
                                label={active ? 'On vacation' : `Starts ${shortDate(fromDateKey(current.start), now)}`}
                                tone={active ? 'success' : 'accent'}
                                dot
                            />
                        </View>
                        <ThemedText size="small" color="muted" style={styles.statusNote}>
                            {active
                                ? `Your blocks are paused. They come back on their own after ${shortDate(
                                      fromDateKey(current.end),
                                      now,
                                  )}.`
                                : 'Your blocks keep working until the first day of the vacation.'}
                        </ThemedText>
                        <Button
                            label={active ? 'End vacation now' : 'Delete vacation'}
                            variant="secondary"
                            icon={active ? undefined : 'Trash'}
                            iconLeading
                            onPress={() => setDialog({ kind: 'remove' })}
                            style={styles.statusButton}
                        />
                    </Card>
                ) : (
                    <>
                        <Card>
                            <RangeCalendar
                                start={start}
                                end={end}
                                minDate={today}
                                onChange={(s, e) => {
                                    setStart(s);
                                    setEnd(e);
                                }}
                            />
                        </Card>
                        <ThemedText size="small" color="muted" align="center" style={styles.hint} tabular>
                            {picked
                                ? `${vacationRangeLabel(picked, now)} · ${days(vacationDays(picked))}`
                                : start
                                ? 'Now tap the last day of your vacation'
                                : 'Tap the first day of your vacation'}
                        </ThemedText>
                        <Button
                            label={picked && picked.start === today ? 'Start vacation' : 'Schedule vacation'}
                            icon="Vacation"
                            iconLeading
                            disabled={!picked}
                            onPress={() => (picked ? setDialog({ kind: 'passphrase', next: picked }) : undefined)}
                            style={styles.save}
                        />
                    </>
                )}

                <SectionHeader title="How it works" />
                <ThemedText size="small" color="muted" style={styles.text}>
                    From the first to the last day you pick, no blocks apply: blocked sites and apps open normally, the
                    DNS filter lets everything through and sleep time stays off.
                </ThemedText>
                <ThemedText size="small" color="muted" style={styles.text}>
                    Starting a vacation takes a long sentence typed out, so it is never done on impulse. Ending it early
                    or deleting it takes one tap. After the last day everything comes back on by itself.
                </ThemedText>
            </ScrollView>

            <PassphrasePopup
                visible={dialog?.kind === 'passphrase'}
                onClose={close}
                phrases={VACATION_MESSAGES}
                message="Vacation mode pauses every block. Type the text below exactly to start it."
                onConfirm={() => (dialog?.kind === 'passphrase' ? save(dialog.next) : undefined)}
            />
            <Dialog
                visible={dialog?.kind === 'remove'}
                onClose={close}
                icon="Shield"
                title={active ? 'End your vacation?' : 'Delete this vacation?'}
                message={
                    active
                        ? 'Your blocks start working again right away.'
                        : 'Your blocks will keep working on these days.'
                }
                actions={confirmActions(close, active ? 'End vacation' : 'Delete', () => save(null))}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={dialog?.kind === 'error'} onClose={close} />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        flex: 1,
        marginHorizontal: spacing.sm,
    },
    statusNote: {
        marginTop: spacing.md,
    },
    statusButton: {
        marginTop: spacing.md,
    },
    hint: {
        marginTop: spacing.md,
        marginHorizontal: gutter,
    },
    save: {
        marginHorizontal: gutter,
        marginTop: spacing.md,
    },
    text: {
        marginHorizontal: gutter + 2,
        marginBottom: spacing.sm,
    },
});

export default VacationScreen;

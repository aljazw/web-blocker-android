import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import ErrorPopup from '../components/ErrorPopup';
import { ListGroup, ListRow, Toggle } from '../components/ListGroup';
import SectionHeader from '../components/SectionHeader';
import { ThemedText } from '../components/ThemedText';
import TimeInput from '../components/TimeInput';
import { gutter, spacing } from '../theme';
import { DayHours, RootStackNavigation } from '../types/types';
import { DEFAULT_DAY_HOURS, getDayHours, getPlanPrefs, setDayHours, setPlanPrefs } from '../storage';
import { isValidTime, sleepDuration } from '../utils/sleep';
import { haptics } from '../utils/haptics';
import { ensureReminderPermission } from '../utils/habitReminders';
import { canAlarmShowOverLockScreen, openAlarmLockScreenSettings, rescheduleWakeAlarm } from '../utils/wakeAlarm';
import { useAppForeground } from '../hooks/useAppForeground';
import { logger } from '../utils/logger';
import { ERRORS } from '../constants/strings';

const split = (hhmm: string) => hhmm.split(':') as [string, string];
const pad = (v: string) => v.padStart(2, '0');

/** Wake-up and bedtime for the day plan. Only plans; sleep time does the blocking. */
const DayHoursScreen: React.FC = () => {
    const navigation = useNavigation<RootStackNavigation>();
    const [saved, setSaved] = useState<DayHours>(DEFAULT_DAY_HOURS);
    const [loaded, setLoaded] = useState(false);
    const [wakeHour, setWakeHour] = useState('07');
    const [wakeMinutes, setWakeMinutes] = useState('00');
    const [bedHour, setBedHour] = useState('23');
    const [bedMinutes, setBedMinutes] = useState('00');
    const [failed, setFailed] = useState(false);
    const [alarm, setAlarm] = useState(false);
    const [lockScreenOk, setLockScreenOk] = useState(true);

    const showTimes = (hours: DayHours) => {
        const [wh, wm] = split(hours.wake);
        const [bh, bm] = split(hours.bedtime);
        setWakeHour(wh);
        setWakeMinutes(wm);
        setBedHour(bh);
        setBedMinutes(bm);
    };

    useFocusEffect(
        useCallback(() => {
            getDayHours()
                .then(hours => {
                    setSaved(hours);
                    showTimes(hours);
                })
                .catch(error => logger.warn('Could not load day hours', error))
                .finally(() => setLoaded(true));
            getPlanPrefs()
                .then(prefs => setAlarm(prefs.wakeAlarm))
                .catch(error => logger.warn('Could not load plan prefs', error));
            canAlarmShowOverLockScreen().then(setLockScreenOk);
        }, []),
    );

    // Back from the full-screen alert setting.
    useAppForeground(() => canAlarmShowOverLockScreen().then(setLockScreenOk));

    const wake = `${pad(wakeHour)}:${pad(wakeMinutes)}`;
    const bedtime = `${pad(bedHour)}:${pad(bedMinutes)}`;
    const valid = isValidTime(wake) && isValidTime(bedtime) && wake !== bedtime;
    const changed = wake !== saved.wake || bedtime !== saved.bedtime;
    // Awake is the stretch from wake-up to bedtime: the sleep window the other way round.
    const awake = (hours: DayHours) => sleepDuration({ bedtime: hours.wake, wake: hours.bedtime });

    const save = async () => {
        const next = { wake, bedtime };
        if (await setDayHours(next)) {
            haptics.success();
            setSaved(next);
            showTimes(next);
            rescheduleWakeAlarm();
        } else {
            setFailed(true);
        }
    };

    const toggleAlarm = async (enabled: boolean) => {
        setAlarm(enabled);
        if (!(await setPlanPrefs({ ...(await getPlanPrefs()), wakeAlarm: enabled }))) {
            setAlarm(!enabled);
            setFailed(true);
            return;
        }
        rescheduleWakeAlarm();
        if (enabled) {
            // The alarm rings through a notification; without permission it stays silent.
            ensureReminderPermission();
        }
    };

    return (
        <BaseScreen
            title="Your day"
            subtitle="When your plan starts and ends"
            headerLeft={<BackButton />}
            isLoading={!loaded}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Card>
                    <ThemedText weight="strong" tabular>
                        {saved.wake} – {saved.bedtime}
                    </ThemedText>
                    <ThemedText size="small" color="muted">
                        {awake(saved)} to plan each day
                    </ThemedText>
                </Card>

                <SectionHeader title="Hours" />
                <View style={styles.times}>
                    <TimeInput
                        label="Wake up"
                        hourValue={wakeHour}
                        minutesValue={wakeMinutes}
                        setHour={setWakeHour}
                        setMinutes={setWakeMinutes}
                    />
                    <View style={styles.timeGap} />
                    <TimeInput
                        label="Bedtime"
                        hourValue={bedHour}
                        minutesValue={bedMinutes}
                        setHour={setBedHour}
                        setMinutes={setBedMinutes}
                    />
                </View>
                {changed && (
                    <Button
                        label={valid ? `Save · ${awake({ wake, bedtime })} day` : 'Enter two different times'}
                        disabled={!valid}
                        onPress={save}
                        style={styles.save}
                    />
                )}

                <ListGroup style={styles.group}>
                    <ListRow
                        icon="Alarm"
                        title="Wake-up alarm"
                        description={
                            alarm && !lockScreenOk
                                ? 'Allow full-screen alerts so it can ring over the lock screen'
                                : `Rings at ${saved.wake}, then plays a short motivation video`
                        }
                        danger={alarm && !lockScreenOk}
                        onDescriptionPress={alarm && !lockScreenOk ? openAlarmLockScreenSettings : undefined}>
                        <Toggle value={alarm} onValueChange={toggleAlarm} />
                    </ListRow>
                </ListGroup>

                <ThemedText size="small" color="muted" style={styles.text}>
                    Tasks are lined up from wake-up and should fit before bedtime. This doesn’t lock your phone.
                </ThemedText>
                <ListGroup style={styles.group}>
                    <ListRow
                        icon="Moon"
                        title="Sleep time"
                        description="Lock your phone at night, set separately"
                        onPress={() => navigation.navigate('Sleep')}
                    />
                </ListGroup>
            </ScrollView>
            <ErrorPopup {...ERRORS.saveFailed} visible={failed} onClose={() => setFailed(false)} />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    times: {
        flexDirection: 'row',
        marginHorizontal: gutter,
    },
    timeGap: {
        width: spacing.md,
    },
    save: {
        marginHorizontal: gutter,
        marginTop: spacing.md,
    },
    text: {
        marginHorizontal: gutter + 2,
        marginTop: spacing.md,
    },
    group: {
        marginTop: spacing.md,
    },
});

export default DayHoursScreen;

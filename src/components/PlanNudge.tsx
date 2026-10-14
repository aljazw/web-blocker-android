import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAppForeground } from '../hooks/useAppForeground';
import { toDateKey } from '../utils/dates';
import { PlanTask, anchorsOf, dayTasks, formatDuration, minutesNow, scheduleDay } from '../utils/dayPlan';
import { completeTask, loadDay, syncPlanReminders, watchPlanReminders } from '../utils/planService';
import { getPlanNudgeLog, getPlanPrefs, setPlanNudgeLog } from '../storage';
import { haptics } from '../utils/haptics';
import { logger } from '../utils/logger';
import Dialog from './Dialog';

/** Pop-ups are spaced out so they stay occasional. */
const MIN_INTERVAL = 20 * 60_000;
/** Ask once the current task runs this many minutes past its length. */
const OVER_BY = 15;
const CHECK_EVERY = 60_000;

type Nudge = { date: string; task: PlanTask; over: number };

interface PlanNudgeProps {
    /** False while the user is busy (a training session, an editor), so nothing interrupts them. */
    canShow: () => boolean;
    onOpenPlan: () => void;
}

/**
 * An occasional in-app check-in when the current task runs well past its
 * length: still on it, or done and forgot to tap? Once per task a day, with
 * at least MIN_INTERVAL between pop-ups. Also keeps plan notifications fresh.
 */
const PlanNudge: React.FC<PlanNudgeProps> = ({ canShow, onOpenPlan }) => {
    const [nudge, setNudge] = useState<Nudge | null>(null);
    const visible = useRef(false);
    visible.current = nudge !== null;
    const checking = useRef(false);

    const check = useCallback(async () => {
        if (visible.current || checking.current || AppState.currentState !== 'active' || !canShow()) {
            return;
        }
        checking.current = true;
        try {
            if (!(await getPlanPrefs()).nudges) {
                return;
            }
            const now = new Date();
            const date = toDateKey(now);
            const [{ day, habits, sleep }, stored] = await Promise.all([loadDay(date), getPlanNudgeLog()]);
            const log = stored.date === date ? stored : { date, shown: [], lastAt: 0 };
            if (Date.now() - log.lastAt < MIN_INTERVAL) {
                return;
            }
            const nowMin = minutesNow(now);
            const { current } = scheduleDay(dayTasks(day, habits), anchorsOf(sleep), nowMin);
            const over = current ? nowMin - (current.start + current.task.duration) : 0;
            if (!current || over < OVER_BY || log.shown.includes(current.task.id) || !canShow()) {
                return;
            }
            await setPlanNudgeLog({ date, shown: [...log.shown, current.task.id], lastAt: Date.now() });
            setNudge({ date, task: current.task, over });
        } catch (error) {
            logger.warn('Plan check-in failed', error);
        } finally {
            checking.current = false;
        }
    }, [canShow]);

    // On launch and on return to the app: refresh notifications and maybe check in.
    const onForeground = useCallback(() => {
        syncPlanReminders();
        check();
    }, [check]);
    useAppForeground(onForeground);
    useEffect(watchPlanReminders, []);
    useEffect(() => {
        const first = setTimeout(onForeground, 1500);
        const id = setInterval(check, CHECK_EVERY);
        return () => {
            clearTimeout(first);
            clearInterval(id);
        };
    }, [check, onForeground]);

    const close = () => setNudge(null);

    const markDone = async () => {
        if (!nudge) {
            return;
        }
        close();
        if (await completeTask(nudge.date, nudge.task, minutesNow(new Date()))) {
            haptics.success();
        }
    };

    return (
        <Dialog
            visible={nudge !== null}
            onClose={close}
            icon="Time"
            title={nudge ? `Still on ${nudge.task.title}?` : ''}
            message={
                nudge
                    ? `It's ${formatDuration(
                          nudge.over,
                      )} longer than planned. If you're done, tap Done so the rest of the day moves on.`
                    : undefined
            }
            actions={[
                {
                    label: 'Still going',
                    variant: 'secondary',
                    onPress: () => {
                        close();
                        onOpenPlan();
                    },
                },
                { label: 'Done', onPress: markDone },
            ]}
        />
    );
};

export default PlanNudge;

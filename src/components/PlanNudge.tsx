import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { PlanBlock } from '../types/types';
import { useAppForeground } from '../hooks/useAppForeground';
import { spacing } from '../theme';
import { toDateKey } from '../utils/dates';
import {
    blockTimes,
    formatDuration,
    formatMinutes,
    isBlockDone,
    minutesNow,
    motivationFor,
    planMoment,
    visibleBlocks,
} from '../utils/dayPlan';
import { completeBlock, loadDayPlan, syncPlanReminders } from '../utils/planService';
import { getHabits, getPlanNudgeLog, getPlanPrefs, setPlanNudgeLog } from '../utils/storage';
import { haptics } from '../utils/haptics';
import { logger } from '../utils/logger';
import Dialog from './Dialog';
import { ThemedText } from './ThemedText';

/** Pop-ups are spaced out so they stay occasional. */
const MIN_INTERVAL = 20 * 60_000;
/** Only ask about blocks that ended within this many minutes. */
const ASK_WINDOW = 180;
const CHECK_EVERY = 60_000;

type Nudge =
    | { kind: 'ask'; date: string; block: PlanBlock }
    | { kind: 'now'; date: string; block: PlanBlock; left: number; next: PlanBlock | null };

interface PlanNudgeProps {
    /** False while the user is busy (a training session, an editor), so nothing interrupts them. */
    canShow: () => boolean;
    onOpenPlan: () => void;
}

/**
 * Occasional in-app check-ins about today's plan: "did you finish the last
 * block?" and "this is what's on now". Each one appears at most once per
 * block, with at least MIN_INTERVAL between them.
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
            const [{ plan }, habits, stored] = await Promise.all([loadDayPlan(date), getHabits(), getPlanNudgeLog()]);
            const log = stored.date === date ? stored : { date, shown: [], lastAt: 0 };
            if (Date.now() - log.lastAt < MIN_INTERVAL) {
                return;
            }
            const blocks = visibleBlocks(plan, habits);
            const nowMin = minutesNow(now);
            const open = (b: PlanBlock) => !isBlockDone(b, habits, date);

            const finished = blocks
                .filter(b => b.end <= nowMin && nowMin - b.end <= ASK_WINDOW && open(b))
                .filter(b => !log.shown.includes(`ask:${b.id}`))
                .pop();
            const moment = planMoment(blocks, nowMin);
            const current =
                moment.kind === 'during' && open(moment.block) && !log.shown.includes(`now:${moment.block.id}`)
                    ? moment
                    : null;

            let next: Nudge | null = null;
            if (finished) {
                next = { kind: 'ask', date, block: finished };
            } else if (current) {
                next = {
                    kind: 'now',
                    date,
                    block: current.block,
                    left: current.block.end - nowMin,
                    next: current.next,
                };
            }
            if (!next || !canShow()) {
                return;
            }
            await setPlanNudgeLog({
                date,
                shown: [...log.shown, `${next.kind}:${next.block.id}`],
                lastAt: Date.now(),
            });
            setNudge(next);
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
        if (await completeBlock(nudge.date, nudge.block)) {
            haptics.success();
        }
    };

    if (nudge?.kind === 'ask') {
        return (
            <Dialog
                visible
                onClose={close}
                icon="Habits"
                title={`Did you finish ${nudge.block.title}?`}
                message={`${blockTimes(nudge.block)}. An honest plan shows you where the day really goes.`}
                actions={[
                    { label: 'Not done', onPress: close, variant: 'secondary' },
                    { label: 'Done', onPress: markDone },
                ]}
            />
        );
    }

    return (
        <Dialog
            visible={nudge?.kind === 'now'}
            onClose={close}
            icon="Plan"
            title={nudge?.kind === 'now' ? `Now: ${nudge.block.title}` : ''}
            message={
                nudge?.kind === 'now' ? (
                    <View>
                        <ThemedText color="muted" tabular>
                            {blockTimes(nudge.block)} · {formatDuration(nudge.left)} left
                        </ThemedText>
                        <ThemedText weight="medium" style={styles.line}>
                            {motivationFor(nudge.date + nudge.block.id)}
                        </ThemedText>
                        {nudge.next && (
                            <ThemedText size="small" color="muted" tabular style={styles.line}>
                                Next · {formatMinutes(nudge.next.start)} {nudge.next.title}
                            </ThemedText>
                        )}
                    </View>
                ) : undefined
            }
            actions={[
                {
                    label: 'Open plan',
                    variant: 'secondary',
                    onPress: () => {
                        close();
                        onOpenPlan();
                    },
                },
                { label: 'On it', onPress: close },
            ]}
        />
    );
};

const styles = StyleSheet.create({
    line: {
        marginTop: spacing.sm,
    },
});

export default PlanNudge;

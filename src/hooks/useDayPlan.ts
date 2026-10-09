import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { DayPlan, PlanBlock } from '../types/types';
import { loadDayPlan, onPlanChanged, persistDayPlan } from '../utils/planService';

/** The plan for one day, reloaded when the screen gains focus or the day changes. */
export const useDayPlan = (dateKey: string) => {
    const [plan, setPlan] = useState<DayPlan>({ date: dateKey, blocks: [] });
    const [loaded, setLoaded] = useState(false);
    const current = useRef(dateKey);
    current.current = dateKey;

    const reload = useCallback(async () => {
        try {
            const result = await loadDayPlan(dateKey);
            // Switching days quickly: ignore a load that finished for the old day.
            if (current.current === dateKey) {
                setPlan(result.plan);
            }
        } finally {
            setLoaded(true);
        }
    }, [dateKey]);

    useEffect(() => {
        setLoaded(false);
        setPlan({ date: dateKey, blocks: [] });
    }, [dateKey]);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload]),
    );
    useEffect(() => onPlanChanged(reload), [reload]);

    /** Shows `next` at once and saves it; rolls back and resolves false if saving fails. */
    const commit = useCallback(
        async (next: DayPlan): Promise<boolean> => {
            const before = plan;
            setPlan(next);
            const ok = await persistDayPlan(next);
            if (!ok) {
                setPlan(before);
            }
            return ok;
        },
        [plan],
    );

    const setBlockDone = useCallback(
        (block: PlanBlock, done: boolean) =>
            commit({
                ...plan,
                blocks: plan.blocks.map(b =>
                    b.id === block.id ? (done ? { ...b, done: true } : (({ done: _d, ...rest }) => rest)(b)) : b,
                ),
            }),
        [commit, plan],
    );

    const addBlocks = useCallback(
        (blocks: PlanBlock[]) => commit({ ...plan, blocks: [...plan.blocks, ...blocks] }),
        [commit, plan],
    );

    return { plan, loaded, reload, commit, setBlockDone, addBlocks };
};

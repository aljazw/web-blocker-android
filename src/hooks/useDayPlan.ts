import { useCallback, useMemo } from 'react';
import { DayPlan, PlanBlock } from '../types/types';
import { STORAGE_KEYS } from '../storage';
import { loadDayPlan, persistDayPlan } from '../utils/planService';
import { useFocusData } from './useFocusData';

const WATCH = [STORAGE_KEYS.dayPlans];

/** The plan for one day; stays current with changes made anywhere (editor, pop-ups). */
export const useDayPlan = (dateKey: string) => {
    const load = useCallback(async () => (await loadDayPlan(dateKey)).plan, [dateKey]);
    const empty = useMemo<DayPlan>(() => ({ date: dateKey, blocks: [] }), [dateKey]);
    const { data, setData, loaded, reload } = useFocusData(load, empty, { watch: WATCH });

    // Right after switching days the previous day's plan is still in state; never show it.
    const current = data.date === dateKey;
    const plan = current ? data : empty;

    /** Shows `next` at once and saves it; rolls back and resolves false if saving fails. */
    const commit = useCallback(
        async (next: DayPlan): Promise<boolean> => {
            const before = plan;
            setData(next);
            const ok = await persistDayPlan(next);
            if (!ok) {
                setData(before);
            }
            return ok;
        },
        [plan, setData],
    );

    const setBlockDone = useCallback(
        (block: PlanBlock, done: boolean) =>
            commit({
                ...plan,
                blocks: plan.blocks.map(b => {
                    if (b.id !== block.id) {
                        return b;
                    }
                    const next: PlanBlock = { ...b, done: true };
                    if (!done) {
                        delete next.done;
                    }
                    return next;
                }),
            }),
        [commit, plan],
    );

    const addBlocks = useCallback(
        (blocks: PlanBlock[]) => commit({ ...plan, blocks: [...plan.blocks, ...blocks] }),
        [commit, plan],
    );

    return { plan, loaded: loaded && current, reload, commit, setBlockDone, addBlocks };
};

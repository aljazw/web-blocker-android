import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types/types';

const TABS: (keyof TabParamList)[] = ['Habits', 'Workout', 'Breathe', 'Block'];
/** Spacing between preloads, so each one is a short task instead of one long freeze. */
const STEP_MS = 120;

/**
 * Mounts the other tabs in the background once the first screen has settled,
 * so the first visit to each tab is instant instead of building it on tap.
 * Call from the initial tab.
 */
export const usePreloadTabs = () => {
    const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();

    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        const task = InteractionManager.runAfterInteractions(() => {
            TABS.forEach((tab, i) => timers.push(setTimeout(() => navigation.preload(tab), 300 + i * STEP_MS)));
        });
        return () => {
            task.cancel();
            timers.forEach(clearTimeout);
        };
    }, [navigation]);
};

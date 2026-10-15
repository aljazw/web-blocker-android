import { NativeModules } from 'react-native';
import { getPromiseVideoShown, setPromiseVideoShown } from '../storage';
import { toDateKey } from './dates';
import { logger } from './logger';

const native: { play?: () => void } | undefined = NativeModules.PromiseVideo;

/**
 * Plays the "keep your word" video the first time tomorrow's plan is opened
 * each day: what goes in the plan is a promise. Never throws.
 */
export const playPromiseVideoOncePerDay = async (): Promise<void> => {
    try {
        const today = toDateKey(new Date());
        if (!native?.play || (await getPromiseVideoShown()) === today) {
            return;
        }
        await setPromiseVideoShown(today);
        native.play();
    } catch (error) {
        logger.warn('Could not play the promise video', error);
    }
};

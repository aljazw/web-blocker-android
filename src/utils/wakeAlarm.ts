import { NativeModules } from 'react-native';
import { logger } from './logger';

const native:
    | {
          reschedule?: () => Promise<boolean>;
          canShowOverLockScreen?: () => Promise<boolean>;
          openLockScreenSettings?: () => void;
      }
    | undefined = NativeModules.WakeAlarm;

/**
 * Arms the native wake-up alarm from the stored plan prefs and day hours (or
 * cancels it). Call after either changes; the alarm re-arms itself daily.
 */
export const rescheduleWakeAlarm = async (): Promise<void> => {
    try {
        await native?.reschedule?.();
    } catch (error) {
        logger.warn('Could not schedule the wake-up alarm', error);
    }
};

/** False on Android 14+ when full-screen alerts are off: the alarm then can't cover the lock screen. */
export const canAlarmShowOverLockScreen = async (): Promise<boolean> => {
    try {
        return (await native?.canShowOverLockScreen?.()) ?? true;
    } catch {
        return true;
    }
};

export const openAlarmLockScreenSettings = () => native?.openLockScreenSettings?.();

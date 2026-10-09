import { NativeModules, Vibration } from 'react-native';

type Kind = 'tap' | 'toggle' | 'success' | 'warning';

const native: { perform?: (kind: Kind) => void } | undefined = NativeModules.Haptics;

/** Short vibrations for when the native module is missing (tests, older builds). */
const FALLBACK: Record<Kind, number | number[]> = {
    tap: 6,
    toggle: 10,
    success: [0, 10, 60, 16],
    warning: [0, 24, 50, 24],
};

const play = (kind: Kind) => {
    if (native?.perform) {
        native.perform(kind);
    } else {
        Vibration.vibrate(FALLBACK[kind]);
    }
};

/**
 * Light system haptics, the same ticks as the keyboard and system UI (and off
 * when the user turned touch feedback off in system settings).
 */
export const haptics = {
    /** Buttons, chips, selections. */
    tap: () => play('tap'),
    /** Switches. */
    toggle: () => play('toggle'),
    /** Something was saved / completed. */
    success: () => play('success'),
    /** Something needs attention. */
    warning: () => play('warning'),
};

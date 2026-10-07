import { Vibration } from 'react-native';

/**
 * Light haptic feedback using the built-in Vibration API (no extra native
 * dependency). Kept very short so it feels like a "tick", not a buzz.
 */
export const haptics = {
    /** Buttons, chips, selections. */
    tap: () => Vibration.vibrate(8),
    /** Switches. */
    toggle: () => Vibration.vibrate(14),
    /** Something was saved / completed. */
    success: () => Vibration.vibrate([0, 12, 70, 20]),
    /** Something needs attention. */
    warning: () => Vibration.vibrate([0, 30, 60, 30]),
};

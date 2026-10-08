/* eslint-disable no-console -- this module is the app's single sanctioned place for console output. */

/**
 * Logs only in development builds, so release builds stay quiet. Use for
 * errors that are recovered from (we keep going, but want to know in dev).
 */
export const logger = {
    warn: (message: string, error?: unknown) => {
        if (__DEV__) {
            console.warn(message, error);
        }
    },
    error: (message: string, error?: unknown) => {
        if (__DEV__) {
            console.error(message, error);
        }
    },
};

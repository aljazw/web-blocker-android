import { NativeModules } from 'react-native';

const { Watchdog } = NativeModules;

/** Whether the accessibility watchdog foreground service is alive. */
export async function isWatchdogRunning(): Promise<boolean> {
    try {
        return await Watchdog.isRunning();
    } catch {
        return false;
    }
}

/** Show the re-enable warning screen now, to verify it appears. */
export async function testWatchdogWarning(): Promise<void> {
    try {
        await Watchdog.testWarning();
    } catch {
        // ignore
    }
}

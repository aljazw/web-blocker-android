import { NativeModules } from 'react-native';

const { Watchdog } = NativeModules;

/** Show the re-enable warning screen now, to verify it appears. */
export async function testWatchdogWarning(): Promise<void> {
    try {
        await Watchdog.testWarning();
    } catch {
        // ignore
    }
}

import { NativeModules } from "react-native";
import { Platform } from 'react-native';


const { AccessibilityStatus, IntentLauncher } = NativeModules;

export async function checkAccessibilityEnabled(): Promise<boolean> {
    try {
        const result = await AccessibilityStatus.isAccessibilityServiceEnabled();
        return result === true;
    } catch (error) {
        console.log("Failed to check accessibility service:", error);
        return false;
    }
}

export function openAccessibilitySettings() {
    if (Platform.OS === 'android') {
        IntentLauncher.startActivity(
            'com.sitelock.OpenAccessibilityActivity'
        );
    }
}

import { NativeModules } from "react-native";

const { AccessibilityStatus } = NativeModules;

export async function checkAccessibilityEnabled(): Promise<boolean> {
    try {
        const result = await AccessibilityStatus.isAccessibilityServiceEnabled();
        return result === true;
    } catch (error) {
        console.log("Failed to check accessibility service:", error);
        return false;
    }
}
import { NativeModules } from 'react-native';
const { DeviceAdminModule } = NativeModules;

export async function checkAdmin() {
    return await DeviceAdminModule.isAdminEnabled();
}

export function toggleDeviceAdmin() {
    return DeviceAdminModule.toggleAdmin();
}

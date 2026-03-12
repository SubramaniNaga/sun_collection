import { Platform } from 'react-native';
import * as Application from 'expo-application';

/**
 * Returns a stable device identifier for API calls.
 * Uses expo-application (works in Expo Go and dev builds); avoids react-native-device-info native module.
 * @returns {Promise<string>}
 */
export async function getDeviceId() {
  try {
    if (Platform.OS === 'android') {
      const id = Application.getAndroidId?.();
      return id != null ? String(id) : `android-${Date.now()}`;
    }
    if (Platform.OS === 'ios') {
      const id = await Application.getIosIdForVendorAsync?.();
      return id != null ? String(id) : `ios-${Date.now()}`;
    }
  } catch (e) {
    console.warn('getDeviceId failed:', e?.message ?? e);
  }
  return `device-${Date.now()}`;
}

import { NativeModules, Platform } from 'react-native';

const DeveloperMode = NativeModules.DeveloperMode;

export async function isDeveloperModeEnabled() {
  return false;
  if (Platform.OS !== 'android') return false;
  if (!DeveloperMode?.isDeveloperModeEnabled) {
    console.warn(
      'Developer mode check unavailable. Rebuild the Android app so the native module is installed.',
    );
    return false;
  }
  try {
    const enabled = Boolean(await DeveloperMode.isDeveloperModeEnabled());
    console.log('Developer mode enabled:', enabled);
    return enabled;
  } catch (error) {
    console.warn('Developer mode check failed:', error?.message ?? error);
    return false;
  }
}

export function openDeveloperSettings() {
  if (Platform.OS !== 'android' || !DeveloperMode?.openDeveloperSettings) {
    return;
  }
  DeveloperMode.openDeveloperSettings();
}

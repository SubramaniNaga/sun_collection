import Constants from 'expo-constants';

/**
 * "Installed" version shown in the update UI comes from here — not by reading app.json at runtime.
 * Expo embeds `expo.version` from app.json into the native bundle when you build (prebuild / EAS / run:android).
 * If you still see an older number (e.g. 0.5.0) after changing app.json, the device is running an old build;
 * rebuild and reinstall so `Constants.expoConfig.version` matches the file.
 */
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

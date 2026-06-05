import * as ImagePicker from 'expo-image-picker';
import { Keyboard, Platform } from 'react-native';
import { compressImageAssetIfNeeded } from './imageCompression';

/**
 * Safe options for expo-image-picker that work on Android and iOS.
 * - Uses string 'images' for mediaTypes (SDK accepts MediaType | MediaType[]).
 * - allowsEditing: false  — disables the built-in crop/edit UI.
 * - quality: 0.5          — compresses the image to ~50% to reduce upload size.
 * - legacy: true on Android for library so selection from file system works.
 */
const getCameraOptions = () => ({
  mediaTypes: 'images',
  allowsEditing: false,
  quality: 0.5,
});

const getLibraryOptions = () => ({
  mediaTypes: 'images',
  allowsEditing: false,
  quality: 0.5,
  ...(Platform.OS === 'android' && { legacy: true }),
});

/**
 * Launch camera and return the selected asset or null.
 * On Android, tries getPendingResultAsync if the main result was canceled (activity may have been killed).
 */
export async function pickFromCamera() {
  Keyboard.dismiss();
  const result = await ImagePicker.launchCameraAsync(getCameraOptions());

  if (!result.canceled && result.assets?.length > 0) {
    return compressImageAssetIfNeeded(result.assets[0]);
  }

  if (Platform.OS === 'android' && result.canceled) {
    try {
      const pending = await ImagePicker.getPendingResultAsync();
      if (pending && !pending.canceled && pending.assets?.length > 0) {
        return compressImageAssetIfNeeded(pending.assets[0]);
      }
    } catch (e) {
      console.warn('getPendingResultAsync fallback failed:', e?.message);
    }
  }

  return null;
}

/**
 * Launch image library and return the selected asset or null.
 */
export async function pickFromLibrary() {
  Keyboard.dismiss();
  const result = await ImagePicker.launchImageLibraryAsync(getLibraryOptions());

  if (!result.canceled && result.assets?.length > 0) {
    return compressImageAssetIfNeeded(result.assets[0]);
  }

  return null;
}

export default { pickFromCamera, pickFromLibrary, getCameraOptions, getLibraryOptions };

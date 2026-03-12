import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Safe options for expo-image-picker that work on Android and iOS.
 * - Uses string 'images' for mediaTypes (SDK accepts MediaType | MediaType[]).
 * - legacy: true on Android for library so selection from file system works.
 */
const getCameraOptions = (aspect = [4, 3]) => ({
  mediaTypes: 'images',
  allowsEditing: true,
  aspect,
  quality: 0.8,
});

const getLibraryOptions = (aspect = [4, 3]) => ({
  mediaTypes: 'images',
  allowsEditing: true,
  aspect,
  quality: 0.8,
  ...(Platform.OS === 'android' && { legacy: true }),
});

/**
 * Launch camera and return the selected asset or null.
 * On Android, tries getPendingResultAsync if the main result was canceled (activity may have been killed).
 */
export async function pickFromCamera(aspect = [4, 3]) {
  const result = await ImagePicker.launchCameraAsync(getCameraOptions(aspect));

  if (!result.canceled && result.assets?.length > 0) {
    return result.assets[0];
  }

  if (Platform.OS === 'android' && result.canceled) {
    try {
      const pending = await ImagePicker.getPendingResultAsync();
      if (pending && !pending.canceled && pending.assets?.length > 0) {
        return pending.assets[0];
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
export async function pickFromLibrary(aspect = [4, 3]) {
  const result = await ImagePicker.launchImageLibraryAsync(getLibraryOptions(aspect));

  if (!result.canceled && result.assets?.length > 0) {
    return result.assets[0];
  }

  return null;
}

export default { pickFromCamera, pickFromLibrary, getCameraOptions, getLibraryOptions };

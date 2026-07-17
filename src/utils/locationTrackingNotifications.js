import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const LOCATION_TRACKING_CHANNEL = 'location-tracking';

let channelReady = false;

export async function ensureLocationTrackingNotificationSetup() {
  if (channelReady) return true;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(LOCATION_TRACKING_CHANNEL, {
      name: 'Location tracking',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 120, 120],
      lightColor: '#1d7ee2',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }
  }

  channelReady = true;
  return true;
}

/**
 * Local notification after each /location-tracking POST (success or failure).
 * Works while app process is alive (foreground, background, or after Recents swipe if FS kept process up).
 */
export async function notifyLocationSendResult({ success, message } = {}) {
  try {
    const ok = await ensureLocationTrackingNotificationSetup();
    if (!ok) return;

    const body =
      message ||
      (success
        ? 'Location update posted successfully.'
        : 'Could not post location update.');

    await Notifications.scheduleNotificationAsync({
      content: {
        title: success ? 'Location sent' : 'Location send failed',
        body,
        data: { type: 'location-tracking', success: Boolean(success) },
        ...(Platform.OS === 'android' ? { channelId: LOCATION_TRACKING_CHANNEL } : {}),
      },
      trigger: null,
    });
  } catch (e) {
    if (__DEV__) {
      console.warn('[location.track] local notification failed:', e?.message || e);
    }
  }
}

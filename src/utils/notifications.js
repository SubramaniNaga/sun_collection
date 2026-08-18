import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { requestHomeFromNotification } from '../navigation/navigationRef';
import { LOCATION_TRACKING_CHANNEL } from './locationTrackingNotifications';

/**
 * Configure how notifications are presented when the app is in the foreground.
 */
export function setNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldAnimate: true,
    }),
  });
}

/**
 * Create the default notification channel on Android (required for Android 8+).
 */
async function setupAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1d7ee2',
    });
  }
}

/**
 * Register for push notifications: request permission, set up Android channel,
 * and return the push token (FCM on Android). Use this token with Firebase Console
 * or your backend to send notifications.
 * @returns {Promise<string|null>} Push token string or null if registration failed.
 */
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }

  await setupAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted.');
    return null;
  }

  try {
    // Returns native FCM token on Android when using google-services.json;
    // use this token in Firebase Console or your backend to send messages.
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data;
    if (token) {
      console.log('🔔 FCM TOKEN:', token);
    } else {
      console.log('🔔 FCM TOKEN: NOT AVAILABLE');
    }
    return token || null;
  } catch (error) {
    console.warn('Failed to get push token:', error);
    return null;
  }
}

function getNotificationType(response) {
  const content = response?.notification?.request?.content;
  const data = content?.data || {};
  const trigger = response?.notification?.request?.trigger;

  if (data.type === 'location-tracking') {
    return 'location-tracking';
  }

  const channelId =
    trigger?.channelId ||
    trigger?.remoteMessage?.notification?.channelId ||
    content?.data?.channelId;

  if (channelId === LOCATION_TRACKING_CHANNEL) {
    return 'location-tracking';
  }

  return 'push';
}

let lastHandledResponseId = null;

export function openHomeFromNotificationResponse(response) {
  if (!response) return;

  if (getNotificationType(response) === 'location-tracking') {
    return;
  }

  const responseId = response.notification?.request?.identifier;
  if (responseId && responseId === lastHandledResponseId) {
    return;
  }
  lastHandledResponseId = responseId || lastHandledResponseId;

  requestHomeFromNotification();
  Notifications.clearLastNotificationResponse();
}

/**
 * Foreground receive + tap handling (background/killed via last response).
 * Tapping a Firebase notification opens HomeScreen once the user is logged in.
 */
export function setupFirebaseNotificationListeners() {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    if (__DEV__) {
      console.log('Firebase notification received:', notification);
    }
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (__DEV__) {
      console.log('Firebase notification opened:', response);
    }
    openHomeFromNotificationResponse(response);
  });

  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse) {
    openHomeFromNotificationResponse(lastResponse);
  }

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

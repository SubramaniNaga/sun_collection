import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { setLoadingContext } from './src/api/apiClient';
import GlobalLoader from './src/components/common/GlobalLoader';
import { COLORS } from './src/constants/theme';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider, useAuthContext } from './src/store/AuthContext';
import { LanguageProvider } from './src/store/LanguageContext';
import { LoadingProvider, useLoading } from './src/store/LoadingContext';
import {
  registerForPushNotificationsAsync,
  setNotificationHandler,
} from './src/utils/notifications';

// How notifications appear when app is in foreground
setNotificationHandler();

const AppContent = () => {
  const loading = useLoading();
  const { isAuthenticated } = useAuthContext();
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  // Set loading context for API clients
  useEffect(() => {
    setLoadingContext(loading);
  }, [loading]);

  // Register for push when user is logged in; listen for notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotificationsAsync();

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        // Notification received while app is in foreground
        console.log('Notification received:', notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        // User tapped the notification
        console.log('Notification response:', response);
      });

    return () => {
      if (notificationListener.current?.remove) {
        notificationListener.current.remove();
      }
      if (responseListener.current?.remove) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated]);

  return (
    <>
      <StatusBar 
        style="light"
        backgroundColor={COLORS.statusBar}
        translucent={false}
      />
      <AppNavigator />
      <GlobalLoader />
    </>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <LoadingProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LoadingProvider>
    </LanguageProvider>
  );
}

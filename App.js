import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { setLoadingContext } from './src/api/apiClient';
import { AppBlockGate } from './src/components/common/AppBlockOverlay';
import GlobalLoader from './src/components/common/GlobalLoader';
import { COLORS } from './src/constants/theme';
import AppNavigator from './src/navigation/AppNavigator';
import AlertProvider from './src/store/AlertContext';
import { AuthProvider, useAuthContext } from './src/store/AuthContext';
import { LanguageProvider } from './src/store/LanguageContext';
import { LoadingProvider, useLoading } from './src/store/LoadingContext';
import {
  registerForPushNotificationsAsync,
  setNotificationHandler,
} from './src/utils/notifications';
// Register background location task at app entry (required for LocationTaskService)
import './src/utils/locationTracker';

// How notifications appear when app is in foreground
setNotificationHandler();

const AppContent = () => {
  const loadingContext = useLoading();
  const { isAuthenticated } = useAuthContext();
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  // Set loading context for API clients
  useEffect(() => {
    setLoadingContext(loadingContext);
  }, [loadingContext]);

  // Hide splash screen when app is ready
  useEffect(() => {
    const hideSplash = async () => {
      if (!loadingContext.globalLoading) {
        await SplashScreen.hideAsync();
      }
    };

    hideSplash();
  }, [loadingContext.globalLoading]);

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
          <AlertProvider>
            <AppBlockGate>
              <AppContent />
            </AppBlockGate>
          </AlertProvider>
        </AuthProvider>
      </LoadingProvider>
    </LanguageProvider>
  );
}

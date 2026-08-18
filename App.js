import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
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
  setupFirebaseNotificationListeners,
} from './src/utils/notifications';
// Register background location task at app entry (required for LocationTaskService)
import './src/utils/locationTracker';

// How notifications appear when app is in foreground
setNotificationHandler();

const AppContent = () => {
  const loadingContext = useLoading();
  const { isAuthenticated } = useAuthContext();

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

  useEffect(() => {
    return setupFirebaseNotificationListeners();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync();
    }
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

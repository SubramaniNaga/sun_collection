import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { setLoadingContext } from './src/api/apiClient';
import GlobalLoader from './src/components/common/GlobalLoader';
import { COLORS } from './src/constants/theme';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/store/AuthContext';
import { LanguageProvider } from './src/store/LanguageContext';
import { LoadingProvider, useLoading } from './src/store/LoadingContext';

const AppContent = () => {
  const loading = useLoading();

  // Set loading context for API clients
  useEffect(() => {
    setLoadingContext(loading);
  }, [loading]);

  return (
    <>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={COLORS.primary} 
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

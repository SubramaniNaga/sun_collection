import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { showAlert, showWarning } from '../../utils/alertService';

const SplashScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [checkingVersion, setCheckingVersion] = useState(false);

  useEffect(() => {
    performAppChecks();
  }, []);

  const performAppChecks = async () => {
    try {
      // Step 1: Check maintenance mode
      const versionData = await apiServices.app.getVersion();
      
      // Step 2: Check maintenance mode first
      if (versionData.isMaintaince) {
        showWarning(
          t('auth.maintenanceMode'),
          versionData.maitainnaceMessage || t('auth.maintenanceInProgress'),
          [{ text: t('common.retry'), onPress: () => performAppChecks() }]
        );
        return;
      }

      // Step 3: Check app version
      setCheckingVersion(true);
      const currentVersion = Constants.expoConfig?.version || '1.0.0';
      const platform = Constants.platform?.ios ? 'ios' : 'android';
      const apiVersion = platform === 'ios' ? versionData.iOSVersion : versionData.androidVersion;
      const forceUpdate = platform === 'ios' ? versionData.iOSForceUpdate : versionData.androidForceUpdate;

      // Compare versions (simple string comparison for this example)
      const needsUpdate = compareVersions(currentVersion, apiVersion) < 0;

      if (needsUpdate) {
        const storeUrl = platform === 'ios' 
          ? 'https://apps.apple.com' 
          : 'https://play.google.com/store/apps';

        showAlert({
          type: 'warning',
          title: t('auth.updateRequired'),
          message: t('auth.newVersionAvailable', { version: apiVersion, currentVersion }),
          buttons: forceUpdate
            ? [{ text: t('auth.updateNow'), onPress: () => Linking.openURL(storeUrl) }]
            : [
                { text: t('auth.updateNow'), onPress: () => Linking.openURL(storeUrl) },
                { text: t('auth.skip'), onPress: () => navigateToMain(), style: 'cancel' },
              ],
        });
      } else {
        // No update needed, navigate to main screen
        navigateToMain();
      }
    } catch (error) {
      console.error('App check error:', error);
      // On error, allow navigation to main screen
      navigateToMain();
    } finally {
      setLoading(false);
      setCheckingVersion(false);
    }
  };

  const compareVersions = (version1, version2) => {
    // Handle undefined or null versions
    if (!version1 || !version2) {
      return 0; // Consider them equal if either is undefined
    }
    
    const v1parts = version1.toString().split('.').map(Number);
    const v2parts = version2.toString().split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }
    
    return 0;
  };

  const navigateToMain = () => {
    navigation.replace('Login');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" backgroundColor={COLORS.statusBar} />
        <View style={styles.content}>
          <Text style={styles.title}>{t('auth.sunCollection')}</Text>
          <Text style={styles.subtitle}>
            {checkingVersion ? t('auth.checkingUpdates') : t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return null; // Splash screen is handled by expo-splash-screen plugin
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: SIZES.h1,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SIZES.base / 2,
  },
  subtitle: {
    fontSize: SIZES.body3,
    color: COLORS.white,
    textAlign: 'center',
  },
});

export default SplashScreen;

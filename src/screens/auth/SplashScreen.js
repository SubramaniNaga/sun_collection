import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppUpdateBottomSheet from '../../components/common/AppUpdateBottomSheet';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { showWarning } from '../../utils/alertService';
import { evaluateAppVersion } from '../../utils/appVersionCheck';

const SplashScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [updatePayload, setUpdatePayload] = useState(null);

  useEffect(() => {
    performAppChecks();
  }, []);

  const performAppChecks = async () => {
    setLoading(true);
    setMaintenanceMode(false);
    setUpdatePayload(null);
    try {
      setCheckingVersion(true);
      const result = await evaluateAppVersion();

      if (result.kind === 'maintenance') {
        setLoading(false);
        setMaintenanceMode(true);
        showWarning(
          t('auth.maintenanceMode'),
          result.message || t('auth.maintenanceInProgress'),
          [{ text: t('common.retry'), onPress: () => performAppChecks() }]
        );
        return;
      }

      if (result.kind === 'update') {
        setLoading(false);
        setUpdatePayload({
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          forceUpdate: result.forceUpdate,
          storeUrl: result.storeUrl,
        });
        return;
      }

      navigateToMain();
    } catch (error) {
      console.error('App check error:', error);
      navigateToMain();
    } finally {
      setCheckingVersion(false);
    }
  };

  const navigateToMain = () => {
    navigation.replace('Login');
  };

  const showSplashShell = loading || maintenanceMode || updatePayload;

  if (!showSplashShell) {
    return null;
  }

  const subtitle = maintenanceMode
    ? t('auth.maintenanceInProgress')
    : updatePayload
      ? t('auth.updateRequired')
      : checkingVersion
        ? t('auth.checkingUpdates')
        : t('common.loading');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor={COLORS.statusBar} />
      <View style={styles.content}>
        <Image
          source={require('../../../assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>{t('auth.sunCollection')}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {updatePayload && (
        <AppUpdateBottomSheet
          visible
          currentVersion={updatePayload.currentVersion}
          latestVersion={updatePayload.latestVersion}
          forceUpdate={updatePayload.forceUpdate}
          storeUrl={updatePayload.storeUrl}
          onContinue={updatePayload.forceUpdate ? undefined : () => navigateToMain()}
        />
      )}
    </SafeAreaView>
  );
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
  logo: {
    width: 120,
    height: 120,
    marginBottom: SIZES.margin,
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

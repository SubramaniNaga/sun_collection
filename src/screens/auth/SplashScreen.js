import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppUpdateBottomSheet from '../../components/common/AppUpdateBottomSheet';
import AppBlockOverlay from '../../components/common/AppBlockOverlay';
import {
  ATTENDANCE,
  applyAppBlockFromResponse,
  applyAttendanceFromResponse,
} from '../../config/appToggles';
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
  const [appBlocked, setAppBlocked] = useState(false);

  const syncBlockState = useCallback(() => {
    const blocked = ATTENDANCE.within_time === 0;
    setAppBlocked(blocked);
    return blocked;
  }, []);

  const performAppChecks = useCallback(async () => {
    setLoading(true);
    setMaintenanceMode(false);
    setUpdatePayload(null);
    setAppBlocked(false);

    try {
      setCheckingVersion(true);
      const result = await evaluateAppVersion();

      if (result.payload) {
        applyAppBlockFromResponse(result.payload);
        applyAttendanceFromResponse(result.payload);
        const { syncLocationTracking } = require('../../utils/locationTracker');
        syncLocationTracking().catch(() => {});
      }

      if (syncBlockState()) {
        setLoading(false);
        return;
      }

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

      navigation.replace('Login');
    } catch (error) {
      if (!syncBlockState()) {
        navigation.replace('Login');
      } else {
        setLoading(false);
      }
    } finally {
      setCheckingVersion(false);
    }
  }, [navigation, syncBlockState, t]);

  useEffect(() => {
    performAppChecks();
  }, [performAppChecks]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        performAppChecks();
      }
    });
    return () => sub.remove();
  }, [performAppChecks]);

  useEffect(() => {
    if (!appBlocked) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [appBlocked]);

  const navigateToMain = () => {
    if (ATTENDANCE.within_time === 0) {
      syncBlockState();
      setLoading(false);
      return;
    }
    navigation.replace('Login');
  };

  if (appBlocked) {
    return <AppBlockOverlay fullScreen />;
  }

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

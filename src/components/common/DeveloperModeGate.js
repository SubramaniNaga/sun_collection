import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { isDeveloperModeEnabled, openDeveloperSettings } from '../../utils/developerMode';

export function DeveloperModeGate({ children }) {
  const { t } = useLanguage();
  const [blocked, setBlocked] = useState(false);
  const [checked, setChecked] = useState(Platform.OS !== 'android');

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setBlocked(false);
      setChecked(true);
      return;
    }
    const enabled = await isDeveloperModeEnabled();
    setBlocked(enabled);
    setChecked(true);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (!checked || !blocked) return undefined;
    SplashScreen.hideAsync().catch(() => {});
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [blocked, checked]);

  if (!checked) return null;

  if (!blocked) return children;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="construct" size={48} color={COLORS.white} />
          </View>
          <Text style={styles.title}>{t('auth.developerModeTitle')}</Text>
          <Text style={styles.message}>{t('auth.developerModeMessage')}</Text>
          <TouchableOpacity style={styles.button} onPress={openDeveloperSettings} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{t('auth.developerModeOpenSettings')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  safe: { flex: 1, backgroundColor: COLORS.primary },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.margin * 1.5,
  },
  title: {
    fontSize: SIZES.h2,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SIZES.base,
  },
  message: {
    fontSize: SIZES.body2,
    color: COLORS.white,
    opacity: 0.95,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SIZES.margin * 2,
  },
  button: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: COLORS.primary,
    fontSize: SIZES.body2,
    fontWeight: '700',
    textAlign: 'center',
  },
});

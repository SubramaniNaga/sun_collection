import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { restoreAttendanceFromStorage, restoreFeatureFlagsFromStorage, subscribeAppBlock } from '../../config/appToggles';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';

function AppBlockOverlay({ message, fullScreen = false }) {
  const { t } = useLanguage();

  return (
    <View style={[styles.root, fullScreen && styles.rootFullScreen]} pointerEvents="auto">
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={48} color={COLORS.white} />
          </View>
          <Text style={styles.title}>{t('auth.appBlockedTitle')}</Text>
          <Text style={styles.message}>
            {message || t('auth.appBlockedMessage')}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Block when within_time === 0 (after appversion / dashboard sets it) */
export function AppBlockGate({ children }) {
  const [blocked, setBlocked] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([restoreAttendanceFromStorage(), restoreFeatureFlagsFromStorage()]).finally(() => {
      if (!cancelled) setRestored(true);
    });
    const unsubscribe = subscribeAppBlock(setBlocked);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!blocked) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [blocked]);

  return (
    <View style={styles.gate}>
      {children}
      {restored && blocked ? <AppBlockOverlay /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1 },
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: COLORS.primary,
  },
  rootFullScreen: {
    position: 'relative',
    flex: 1,
    zIndex: 0,
    elevation: 0,
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
  },
});

export default AppBlockOverlay;

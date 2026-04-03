import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import AppUpdateBottomSheet from '../../components/common/AppUpdateBottomSheet';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useAppVersionCheck } from '../../hooks/useAppVersionCheck';
import Dashboard from '../../models/Dashboard';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';
import { showAlert } from '../../utils/alertService';
import { syncUserLanguageWithApi } from '../../utils/syncUserLanguageWithApi';

const LANG_SWITCH_W = 58;
const LANG_SWITCH_H = 30;
const LANG_THUMB = 26;
const LANG_PAD = 2;
const LANG_THUMB_TRAVEL = LANG_SWITCH_W - LANG_THUMB - LANG_PAD * 2;

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { t, language, changeLanguage } = useLanguage();
  const { user, updateUser } = useAuthContext();
  const { runCheck, updatePayload, clearUpdate } = useAppVersionCheck();
  const [dashboardData, setDashboardData] = useState(null);
  const [langSaving, setLangSaving] = useState(false);
  const slideAnim = useRef(
    new Animated.Value(language === 'ta' ? LANG_THUMB_TRAVEL : 0)
  ).current;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiServices.dashboard.getTodayStats();
      if (response.success && response.data) {
        const dashboard = Dashboard.fromApiResponse(response.data);
        setDashboardData(dashboard);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
      runCheck();
    }, [fetchDashboardData, runCheck])
  );

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: language === 'ta' ? LANG_THUMB_TRAVEL : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  }, [language, slideAnim]);

  const handleNotificationPress = () => {
    // Navigate to notifications screen or show notification drawer
    console.log('Notification pressed');
    // You can navigate to a notifications screen when it's ready
    // navigation.navigate('Notifications');
  };

  const handleHomeLanguageChange = async (newLanguage) => {
    if (newLanguage === language || langSaving) return;
    setLangSaving(true);
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      const userId = user?.id ?? storedUserId;
      if (!userId) {
        showAlert({
          type: 'error',
          title: t('common.error'),
          message: t('profile.updateFailed') || 'Unable to update language. Please login again.',
        });
        return;
      }
      await syncUserLanguageWithApi(newLanguage, userId);
      await changeLanguage(newLanguage);
      updateUser({ language: newLanguage, lang: newLanguage });
    } catch (error) {
      console.error('Home language change error:', error);
      const message =
        error?.code === 'NO_AUTH'
          ? t('profile.updateFailed') || 'Unable to update language. Please login again.'
          : error?.response?.data?.message || 'Failed to change language. Please try again.';
      showAlert({
        type: 'error',
        title: t('common.error'),
        message,
      });
    } finally {
      setLangSaving(false);
    }
  };

  

  
  const menuItems = [
    {
      id: 'collection',
      title: t('home.collection'),
      icon: 'cash-outline',
      onPress: () => navigation.navigate('Collection'),
    },
    {
      id: 'nip',
      title: t('home.nip'),
      icon: 'link-outline',
      onPress: () => navigation.navigate('NIP'),
    },
    {
      id: 'expenses',
      title: t('home.expenses'),
      icon: 'card-outline',
      onPress: () => navigation.navigate('Expenses'),
    },
    {
      id: 'loan',
      title: t('home.loanManagement'),
      icon: 'document-text-outline',
      onPress: () => navigation.navigate('Loan'),
    },
    {
      id: 'upfront-cash',
      title: t('home.upfrontCash'),
      icon: 'wallet-outline',
      onPress: () => navigation.navigate('UpfrontCash'),
    },
    {
      id: 'collection-history',
      title: t('home.collectionHistory'),
      icon: 'bar-chart-outline',
      onPress: () => navigation.navigate('CollectionHistory'),
    },

  ];

  return (
    <>
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('home.title')}
        showMenuButton={true}
        onMenuPress={() => navigation.openDrawer()}
        rightComponent={
          <View style={styles.headerRight}>
            <View
              style={[
                styles.langSwitchTrack,
                langSaving && styles.langSwitchTrackDisabled,
              ]}
            >
              {language === 'ta' && (
                <View style={styles.langSwitchInactiveLeft} pointerEvents="none">
                  <Text style={styles.langSwitchInactiveText}>EN</Text>
                </View>
              )}
              {language === 'en' && (
                <View style={styles.langSwitchInactiveRight} pointerEvents="none">
                  <Text style={styles.langSwitchInactiveText}>TA</Text>
                </View>
              )}
              <Animated.View
                style={[
                  styles.langSwitchThumb,
                  { transform: [{ translateX: slideAnim }] },
                ]}
              >
                <Text style={styles.langSwitchThumbText}>
                  {language === 'en' ? 'EN' : 'TA'}
                </Text>
              </Animated.View>
              <View style={styles.langSwitchHitRow}>
                <TouchableOpacity
                  style={styles.langSwitchHitHalf}
                  onPress={() => handleHomeLanguageChange('en')}
                  disabled={langSaving}
                  activeOpacity={0.7}
                />
                <TouchableOpacity
                  style={styles.langSwitchHitHalf}
                  onPress={() => handleHomeLanguageChange('ta')}
                  disabled={langSaving}
                  activeOpacity={0.7}
                />
              </View>
            </View>
            <TouchableOpacity
              onPress={handleNotificationPress}
              style={styles.notificationButton}
            >
              <Ionicons name="notifications-outline" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dashboard Section */}
        <View style={styles.dashboardSection}>
          <Text style={styles.dashboardTitle}>{t('home.todaysStatistics')}</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>{t('home.loadingDashboard')}</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={24} color={COLORS.error} />
              <Text style={styles.errorText}>{error || t('home.failedToLoadDashboard')}</Text>
              <TouchableOpacity onPress={fetchDashboardData} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : dashboardData ? (
            <View style={styles.dashboardGrid}>
              {/* Frontcash Card */}
              <TouchableOpacity
                style={[styles.dashboardCard, styles.frontcashCard]}
                onPress={() => navigation.navigate('UpfrontCashAdd')}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <Ionicons name="wallet" size={24} color={COLORS.white} />
                  <Text style={styles.cardHeaderText}>{t('home.frontcash')}</Text>
                </View>
                <Text style={styles.cardAmount}>{dashboardData.getFormattedFrontcashAmount()}</Text>
                <Text style={styles.cardCount}>{dashboardData.frontcash.count} {t('home.transactions')}</Text>
              </TouchableOpacity>

              {/* Loans Given Card */}
              <TouchableOpacity
                style={[styles.dashboardCard, styles.loansCard]}
                onPress={() => navigation.navigate('Loan')}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <Ionicons name="document-text" size={24} color={COLORS.white} />
                  <Text style={styles.cardHeaderText}>{t('home.loansGiven')}</Text>
                </View>
                <Text style={styles.cardAmount}>{dashboardData.getFormattedLoansGivenAmount()}</Text>
                <Text style={styles.cardCount}>{dashboardData.loansGiven.count} {t('home.loans')}</Text>
              </TouchableOpacity>

              {/* Collections Card */}
              <TouchableOpacity
                style={[styles.dashboardCard, styles.collectionsCard]}
                onPress={() => navigation.navigate('CollectionHistory')}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <Ionicons name="cash" size={24} color={COLORS.white} />
                  <Text style={styles.cardHeaderText}>{t('home.collections')}</Text>
                </View>
                <Text style={styles.cardAmount}>{dashboardData.getFormattedCollectionsAmount()}</Text>
                <Text style={styles.cardCount}>{dashboardData.collections.count} {t('home.collectionsCount')}</Text>
              </TouchableOpacity>

              {/* Expenses Card */}
              <TouchableOpacity
                style={[styles.dashboardCard, styles.expensesCard]}
                onPress={() => navigation.navigate('Expenses')}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <Ionicons name="card" size={24} color={COLORS.white} />
                  <Text style={styles.cardHeaderText}>{t('home.expenses')}</Text>
                </View>
                <Text style={styles.cardAmount}>{dashboardData.getFormattedExpensesAmount()}</Text>
                <Text style={styles.cardCount}>{dashboardData.expenses.count} {t('home.expensesCount')}</Text>
              </TouchableOpacity>

              {/* Tracking Card - Full Width 
              <View style={[styles.dashboardCard, styles.trackingCard, styles.fullWidthCard]}>
                <View style={styles.cardHeader}>
                  <Ionicons 
                    name={dashboardData.tracking.isTracking ? "location" : "location-outline"} 
                    size={24} 
                    color={COLORS.white} 
                  />
                  <Text style={styles.cardHeaderText}>Tracking</Text>
                  <View style={[
                    styles.trackingStatusBadge,
                    dashboardData.tracking.isTracking && styles.trackingActiveBadge
                  ]}>
                    <Text style={styles.trackingStatusText}>
                      {dashboardData.tracking.isTracking ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <View style={styles.trackingStats}>
                  <View style={styles.trackingStatItem}>
                    <Ionicons name="time-outline" size={20} color={COLORS.white} />
                    <Text style={styles.trackingStatLabel}>Time</Text>
                    <Text style={styles.trackingStatValue}>
                      {dashboardData.getFormattedTrackingTime()}
                    </Text>
                  </View>
                  <View style={styles.trackingStatItem}>
                    <Ionicons name="navigate-outline" size={20} color={COLORS.white} />
                    <Text style={styles.trackingStatLabel}>Distance</Text>
                    <Text style={styles.trackingStatValue}>
                      {dashboardData.getFormattedTrackingDistance()}
                    </Text>
                  </View>
                </View>
              </View>
              */}
            </View>
          ) : null}
        </View>

        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={28} color={COLORS.primary} />
              <Text style={styles.cardTitle}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
    {updatePayload && (
      <AppUpdateBottomSheet
        visible
        currentVersion={updatePayload.currentVersion}
        latestVersion={updatePayload.latestVersion}
        forceUpdate={updatePayload.forceUpdate}
        storeUrl={updatePayload.storeUrl}
        onContinue={updatePayload.forceUpdate ? undefined : clearUpdate}
      />
    )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    // marginTop: SIZES.margin * 2,
  },
  menuCard: {
    width: '30%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    padding: SIZES.base,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
    minHeight: 100,
    marginBottom: SIZES.margin,
  },
  cardTitle: {
    fontSize: SIZES.body4,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langSwitchTrack: {
    width: LANG_SWITCH_W,
    height: LANG_SWITCH_H,
    borderRadius: LANG_SWITCH_H / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
    marginRight: 6,
    justifyContent: 'center',
  },
  langSwitchTrackDisabled: {
    opacity: 0.55,
  },
  langSwitchInactiveLeft: {
    position: 'absolute',
    left: 6,
    top: LANG_PAD,
    bottom: LANG_PAD,
    justifyContent: 'center',
    minWidth: 18,
  },
  langSwitchInactiveRight: {
    position: 'absolute',
    right: 6,
    top: LANG_PAD,
    bottom: LANG_PAD,
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 18,
  },
  langSwitchInactiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.42)',
    letterSpacing: 0.2,
  },
  langSwitchThumb: {
    position: 'absolute',
    left: LANG_PAD,
    top: LANG_PAD,
    width: LANG_THUMB,
    height: LANG_THUMB,
    borderRadius: LANG_THUMB / 2,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  langSwitchThumbText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  langSwitchHitRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  langSwitchHitHalf: {
    flex: 1,
  },
  notificationButton: {
    padding: SIZES.padding / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardSection: {
    marginTop: 0,
    marginBottom: SIZES.margin,
    paddingTop: 0,
  },
  dashboardTitle: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.text.secondary,
    marginBottom: SIZES.margin,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dashboardCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  fullWidthCard: {
    width: '100%',
  },
  frontcashCard: {
    backgroundColor: '#1d7ee2',
  },
  loansCard: {
    backgroundColor: '#34C759',
  },
  collectionsCard: {
    backgroundColor: '#FF9500',
  },
  expensesCard: {
    backgroundColor: '#FF3B30',
  },
  trackingCard: {
    backgroundColor: '#5856D6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.padding,
  },
  cardHeaderText: {
    fontSize: SIZES.body4,
    fontWeight: '600',
    color: COLORS.white,
    marginLeft: SIZES.base,
    flex: 1,
  },
  cardAmount: {
    fontSize: SIZES.h2,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SIZES.base / 2,
  },
  cardCount: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    opacity: 0.9,
  },
  trackingStatusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
  },
  trackingActiveBadge: {
    backgroundColor: COLORS.success,
  },
  trackingStatusText: {
    fontSize: SIZES.body5,
    fontWeight: '600',
    color: COLORS.white,
  },
  trackingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SIZES.padding,
  },
  trackingStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  trackingStatLabel: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: SIZES.base / 2,
    marginBottom: SIZES.base / 2,
  },
  trackingStatValue: {
    fontSize: SIZES.body1,
    fontWeight: '700',
    color: COLORS.white,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  loadingText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding * 2,
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
  },
  errorText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body3,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SIZES.margin,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body3,
    fontWeight: '600',
  },
});

export default HomeScreen;

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
import { SafeAreaView } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import AppUpdateBottomSheet from '../../components/common/AppUpdateBottomSheet';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useAppVersionCheck } from '../../hooks/useAppVersionCheck';
import Collection from '../../models/Collection';
import Dashboard from '../../models/Dashboard';
import NIPLoan from '../../models/NIPLoan';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showAlert, showError } from '../../utils/alertService';
import ErrorHandler from '../../utils/errorHandler';
import { getCurrentDateString } from '../../utils/dateFormatter';
import { syncUserLanguageWithApi } from '../../utils/syncUserLanguageWithApi';

const LANG_SWITCH_W = 58;
const LANG_SWITCH_H = 30;
const LANG_THUMB = 26;
const LANG_PAD = 2;
const LANG_THUMB_TRAVEL = LANG_SWITCH_W - LANG_THUMB - LANG_PAD * 2;

/** Normalize GET /frontcash/dashboard/today response for Dashboard.fromApiResponse */
function dashboardDataFromTodayApi(res) {
  if (!res || typeof res !== 'object') return {};
  if (res.success && res.data && typeof res.data === 'object') return res.data;
  if (res.data && typeof res.data === 'object') {
    const d = res.data;
    if (d.expenses != null || d.collections != null || d.frontcash != null || d.loans_given != null) {
      return d;
    }
  }
  if (res.expenses != null || res.collections != null || res.frontcash != null || res.loans_given != null) {
    return res;
  }
  return {};
}

const formatRupee = (value) => {
  const amount = parseFloat(value) || 0;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const HomeScreen = ({ navigation }) => {
  const { t, language, changeLanguage } = useLanguage();
  const { user, updateUser } = useAuthContext();
  const { runCheck, updatePayload, clearUpdate } = useAppVersionCheck();
  const [langSaving, setLangSaving] = useState(false);
  const slideAnim = useRef(
    new Animated.Value(language === 'ta' ? LANG_THUMB_TRAVEL : 0)
  ).current;

  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const dashboardAlertShownRef = useRef(false);

  const [collectionSummary, setCollectionSummary] = useState({ totalBalance: 0, count: 0 });
  const [nipSummary, setNipSummary] = useState({ totalBalance: 0, count: 0 });
  const loadHomeDataRef = useRef(null);

  const showDashboardLoadError = useCallback((error) => {
    if (error && ErrorHandler.isAuthError(error)) {
      return;
    }
    if (dashboardAlertShownRef.current) {
      return;
    }
    dashboardAlertShownRef.current = true;
    showError(
      t('common.error'),
      getApiErrorMessage(error, t('home.failedToLoadDashboard')),
      [
        {
          text: t('common.retry'),
          onPress: () => {
            dashboardAlertShownRef.current = false;
            loadHomeDataRef.current?.();
          },
        },
        { text: t('common.ok') },
      ],
    );
  }, [t]);

  const loadHomeData = useCallback(async () => {
    setLoadingDashboard(true);

    let dashboardFetchError = null;
    const dashPromise = apiServices.dashboard.getTodayStats().catch((err) => {
      dashboardFetchError = err;
      return null;
    });

    const today = getCurrentDateString();
    const summaryPromise = Promise.all([
      // Collection API commented out — hideDetails: true on the home card means
      // totalBalance/count are not displayed. Re-enable when the card shows details.
      // apiServices.collection.getCollectionList({ collection_date: today }).catch(() => null),
      Promise.resolve(null),
      apiServices.loan.getNIPList({ page: 1, limit: 500 }).catch(() => null),
    ]);

    try {
      const [res, [colRes, nipRes]] = await Promise.all([dashPromise, summaryPromise]);

      if (res != null) {
        const raw = dashboardDataFromTodayApi(res);
        if (Object.keys(raw).length > 0) {
          setDashboardData(Dashboard.fromApiResponse(raw));
          dashboardAlertShownRef.current = false;
        } else {
          setDashboardData(null);
          showDashboardLoadError(dashboardFetchError);
        }
      } else {
        setDashboardData(null);
        showDashboardLoadError(dashboardFetchError);
      }

      // Collection summary processing commented out — re-enable together with the API call above
      // when the Collection home card shows hideDetails: false.
      // if (colRes) {
      //   const colRaw = colRes?.response ?? colRes?.data ?? [];
      //   const colArr = Array.isArray(colRaw) ? colRaw : [];
      //   const collections = Collection.fromApiResponseArray(colArr);
      //   const totalColBalance = collections.reduce(
      //     (sum, c) => sum + (parseFloat(c.balanceAmount) || 0),
      //     0
      //   );
      //   setCollectionSummary({ totalBalance: totalColBalance, count: collections.length });
      // } else {
      //   setCollectionSummary({ totalBalance: 0, count: 0 });
      // }

      if (nipRes) {
        const nipRaw = Array.isArray(nipRes?.data) ? nipRes.data : [];
        const nips = NIPLoan.fromApiResponseArray(nipRaw);
        const totalNipBalance = nips.reduce(
          (sum, n) => sum + (parseFloat(n.balanceAmount) || 0),
          0
        );
        setNipSummary({ totalBalance: totalNipBalance, count: nips.length });
      } else {
        setNipSummary({ totalBalance: 0, count: 0 });
      }
    } finally {
      setLoadingDashboard(false);
    }
  }, [showDashboardLoadError]);

  loadHomeDataRef.current = loadHomeData;

  useFocusEffect(
    useCallback(() => {
      runCheck();
      loadHomeData();
    }, [runCheck, loadHomeData])
  );

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: language === 'ta' ? LANG_THUMB_TRAVEL : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  }, [language, slideAnim]);

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

  const renderAmountCard = ({
    cardKey,
    backgroundColor,
    iconName,
    title,
    amountText,
    subText,
    onPress,
    outlined,
    hideDetails,
  }) => {
    const isOutlined = Boolean(outlined);
    return (
      <TouchableOpacity
        key={cardKey}
        style={[
          styles.amountCard,
          isOutlined ? styles.amountCardOutlined : { backgroundColor },
          hideDetails && styles.amountCardCentered,
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View style={[styles.amountCardHeader, hideDetails && styles.amountCardHeaderCentered]}>
          <Ionicons
            name={iconName}
            size={hideDetails ? 32 : 24}
            color={isOutlined ? COLORS.primary : COLORS.white}
          />
          <Text
            style={[
              styles.amountCardHeaderText,
              isOutlined && styles.amountCardHeaderTextOutlined,
              hideDetails && styles.amountCardHeaderTextLarge,
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        {!hideDetails && (
          <>
            <Text style={[styles.amountCardValue, isOutlined && styles.amountCardValueOutlined]}>
              {amountText}
            </Text>
            <Text
              style={[styles.amountCardSub, isOutlined && styles.amountCardSubOutlined]}
              numberOfLines={2}
            >
              {subText}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

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
            <TouchableOpacity
              style={[
                styles.langSwitchTrack,
                langSaving && styles.langSwitchTrackDisabled,
              ]}
              onPress={() => handleHomeLanguageChange(language === 'en' ? 'ta' : 'en')}
              disabled={langSaving}
              activeOpacity={0.8}
            >
              {language === 'ta' && (
                <View style={styles.langSwitchInactiveLeft} pointerEvents="none">
                  <Text style={styles.langSwitchInactiveText}>EN</Text>
                </View>
              )}
              {language === 'en' && (
                <View style={styles.langSwitchInactiveRight} pointerEvents="none">
                  <Text style={styles.langSwitchInactiveText}>த</Text>
                </View>
              )}
              <Animated.View
                style={[
                  styles.langSwitchThumb,
                  { transform: [{ translateX: slideAnim }] },
                ]}
              >
                <Text style={styles.langSwitchThumbText}>
                  {language === 'en' ? 'EN' : 'த'}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardSection}>
          <Text style={styles.dashboardTitle}>{t('home.todaysStatistics')}</Text>

          {loadingDashboard ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>{t('home.loadingDashboard')}</Text>
            </View>
          ) : (
            <>
              <View style={styles.homeGrid}>
                {renderAmountCard({
                  cardKey: 'collection',
                  backgroundColor: '#1d7ee2',
                  iconName: 'cash-outline',
                  title: t('home.collection'),
                  amountText: formatRupee(collectionSummary.totalBalance),
                  subText: `${collectionSummary.count} ${t('home.dueToday')}`,
                  onPress: () => navigation.navigate('Collection'),
                  hideDetails: true,
                })}

                {renderAmountCard({
                  cardKey: 'loan-mgmt',
                  iconName: 'document-text-outline',
                  title: t('home.loanManagement'),
                  amountText: dashboardData
                    ? dashboardData.getFormattedLoansGivenAmount()
                    : formatRupee(0),
                  subText: `${dashboardData?.loansGiven?.count ?? 0} ${t('home.loans')}`,
                  onPress: () => navigation.navigate('Loan'),
                  outlined: true,
                })}

                {renderAmountCard({
                  cardKey: 'upfront-cash',
                  backgroundColor: '#34C759',
                  iconName: 'wallet-outline',
                  title: t('home.upfrontCash'),
                  amountText: dashboardData
                    ? dashboardData.getFormattedFrontcashAmount()
                    : formatRupee(0),
                  subText: `${dashboardData?.frontcash?.count ?? 0} ${t('home.transactions')}`,
                  onPress: () => navigation.navigate('UpfrontCash'),
                })}

                {renderAmountCard({
                  cardKey: 'expenses',
                  backgroundColor: '#FF3B30',
                  iconName: 'card-outline',
                  title: t('home.expenses'),
                  amountText: dashboardData
                    ? dashboardData.getFormattedExpensesAmount()
                    : formatRupee(0),
                  subText: `${dashboardData?.expenses?.count ?? 0} ${t('home.expensesCount')}`,
                  onPress: () => navigation.navigate('Expenses'),
                })}

                {renderAmountCard({
                  cardKey: 'coll-hist',
                  backgroundColor: '#FF9500',
                  iconName: 'bar-chart-outline',
                  title: t('home.collectionHistory'),
                  amountText: dashboardData
                    ? dashboardData.getFormattedCollectionsAmount()
                    : formatRupee(0),
                  subText: `${dashboardData?.collections?.count ?? 0} ${t('home.collectionsCount')}`,
                  onPress: () => navigation.navigate('CollectionHistory'),
                })}

                {renderAmountCard({
                  cardKey: 'nip',
                  backgroundColor: '#5856D6',
                  iconName: 'link-outline',
                  title: t('home.nip'),
                  amountText: formatRupee(nipSummary.totalBalance),
                  subText: `${nipSummary.count} ${t('home.loans')}`,
                  onPress: () => navigation.navigate('NIP'),
                })}
              </View>

              <TouchableOpacity
                style={styles.cashAccountCard}
                onPress={() => navigation.navigate('CashAccount')}
                activeOpacity={0.85}
              >
                <Ionicons name="calculator-outline" size={22} color={COLORS.white} />
                <Text style={styles.cashAccountCardText}>{t('cashAccount.closeAccount')}</Text>
              </TouchableOpacity>
            </>
          )}
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
    paddingBottom: SIZES.padding * 2,
  },
  homeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cashAccountCard: {
    marginTop: SIZES.base,
    backgroundColor: '#0F766E',
    borderRadius: SIZES.radius * 1.5,
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  cashAccountCardText: {
    marginLeft: SIZES.base,
    fontSize: SIZES.body3,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: -0.2,
  },
  amountCard: {
    width: '48%',
    minHeight: 132,
    borderRadius: SIZES.radius * 1.5,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  amountCardOutlined: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: '#1d7ee2',
    shadowOpacity: 0.08,
    elevation: 3,
  },
  amountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  amountCardCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountCardHeaderCentered: {
    justifyContent: 'center',
    marginBottom: 0,
    flex: 1,
  },
  amountCardHeaderTextLarge: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    textAlign: 'center',
  },
  amountCardHeaderText: {
    flex: 1,
    fontSize: SIZES.body4,
    fontWeight: '600',
    color: COLORS.white,
    marginLeft: SIZES.base,
  },
  amountCardHeaderTextOutlined: {
    color: COLORS.primary,
  },
  amountCardValue: {
    fontSize: SIZES.h2,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SIZES.base / 2,
  },
  amountCardValueOutlined: {
    color: COLORS.primary,
  },
  amountCardSub: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    opacity: 0.92,
  },
  amountCardSubOutlined: {
    color: COLORS.text.secondary,
    opacity: 1,
  },
  dashboardSection: {
    marginBottom: SIZES.margin,
  },
  dashboardTitle: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.text.secondary,
    marginBottom: SIZES.margin,
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
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
});

export default HomeScreen;

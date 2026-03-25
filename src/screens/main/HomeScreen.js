import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import Dashboard from '../../models/Dashboard';
import { useLanguage } from '../../store/LanguageContext';

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [dashboardData, setDashboardData] = useState(null);
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
    }, [fetchDashboardData])
  );

  const handleNotificationPress = () => {
    // Navigate to notifications screen or show notification drawer
    console.log('Notification pressed');
    // You can navigate to a notifications screen when it's ready
    // navigation.navigate('Notifications');
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
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('home.title')}
        showMenuButton={true}
        onMenuPress={() => navigation.openDrawer()}
        rightComponent={
          <TouchableOpacity
            onPress={handleNotificationPress}
            style={styles.notificationButton}
          >
            <Ionicons name="notifications-outline" size={24} color={COLORS.white} />
          </TouchableOpacity>
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
              <View style={[styles.dashboardCard, styles.frontcashCard]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="wallet" size={24} color={COLORS.white} />
                  <Text style={styles.cardHeaderText}>{t('home.frontcash')}</Text>
                </View>
                <Text style={styles.cardAmount}>{dashboardData.getFormattedFrontcashAmount()}</Text>
                <Text style={styles.cardCount}>{dashboardData.frontcash.count} {t('home.transactions')}</Text>
              </View>

              {/* Loans Given Card */}
              <View style={[styles.dashboardCard, styles.loansCard]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="document-text" size={24} color={COLORS.white} />
                  <Text style={styles.cardHeaderText}>{t('home.loansGiven')}</Text>
                </View>
                <Text style={styles.cardAmount}>{dashboardData.getFormattedLoansGivenAmount()}</Text>
                <Text style={styles.cardCount}>{dashboardData.loansGiven.count} {t('home.loans')}</Text>
              </View>

              {/* Collections Card */}
              <View style={[styles.dashboardCard, styles.collectionsCard]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="cash" size={24} color={COLORS.white} />
                  <Text style={styles.cardHeaderText}>{t('home.collections')}</Text>
                </View>
                <Text style={styles.cardAmount}>{dashboardData.getFormattedCollectionsAmount()}</Text>
                <Text style={styles.cardCount}>{dashboardData.collections.count} {t('home.collectionsCount')}</Text>
              </View>

              {/* Expenses Card */}
              <View style={[styles.dashboardCard, styles.expensesCard]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="card" size={24} color={COLORS.white} />
                  <Text style={styles.cardHeaderText}>{t('home.expenses')}</Text>
                </View>
                <Text style={styles.cardAmount}>{dashboardData.getFormattedExpensesAmount()}</Text>
                <Text style={styles.cardCount}>{dashboardData.expenses.count} {t('home.expensesCount')}</Text>
              </View>

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

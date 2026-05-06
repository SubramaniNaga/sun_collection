import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import DatePicker from '../../components/common/DatePicker';
import Header from '../../components/common/Header';
import ListSkeleton from '../../components/common/ListSkeleton';
import { COLORS, SIZES } from '../../constants/theme';
import CollectionHistory from '../../models/CollectionHistory';
import Dashboard from '../../models/Dashboard';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError, showSuccess } from '../../utils/alertService';
import { formatDateForAPI, getCurrentDateString } from '../../utils/dateFormatter';

const LIMIT = 10;

/** Space so list scrolls above the fixed bottom “Account closing” bar */
const LIST_EXTRA_BOTTOM = 88;

/**
 * `stats.closingbalance` (or `closing_balance`) from GET /collection/history:
 * when set (e.g. 1 or true), period is closed — hide Account closing UI. Missing/false/0 → show.
 */
function isClosingBalanceDone(statsLike) {
  if (!statsLike || typeof statsLike !== 'object') return false;
  const v = statsLike.closingbalance ?? statsLike.closing_balance;
  if (v === true) return true;
  if (v === 1 || v === '1') return true;
  if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
  return false;
}

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

const CollectionHistoryScreen = ({ navigation }) => {
  const { t } = useLanguage();
  // State for date filters
  const [startDate, setStartDate] = useState(new Date().toISOString());
  const [endDate, setEndDate] = useState(new Date().toISOString());
  const [errors, setErrors] = useState({});

  // State for collection data
  const [collectionHistory, setCollectionHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Stats from API
  const [stats, setStats] = useState({
    total_count: 0,
    total_amount: 0,
    cash_count: 0,
    non_cash_count: 0,
    collected_amount: 0,
    expenses_spent: 0,
    loan_given_amount: 0,
  });

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    hasNextPage: false,
    totalPages: 1,
  });

  // Payment type filter state (null = all, 'cash' = cash, 'online' = online)
  const [selectedPaymentType, setSelectedPaymentType] = useState(null);

  const [showClosingModal, setShowClosingModal] = useState(false);
  const [closingForm, setClosingForm] = useState({
    expensesSpent: '',
    loanGiven: '',
    cashBrought: '',
    collectionCompleted: '',
  });
  const [closingDataLoading, setClosingDataLoading] = useState(false);
  const [closingSubmitting, setClosingSubmitting] = useState(false);

  // Validation function
  const validateDates = () => {
    const newErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Clear time part for accurate date comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Check if start date is greater than end date
    if (start > end) {
      newErrors.dateRange = t('validation.startDateGreater');
    }

    // Check if end date is beyond current date
    if (end > today) {
      newErrors.dateRange = t('validation.endDateBeyond');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler for start date change
  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);
    // Clear errors when start date changes
    setErrors({});
  };

  // Handler for end date change
  const handleEndDateChange = (newEndDate) => {
    setEndDate(newEndDate);
    // Clear any existing errors when a valid date is selected
    setErrors({});
  };

  // Fetch collection history from API
  const fetchCollectionHistory = useCallback(async (page = 1, append = false) => {
    if (!validateDates()) {
      return;
    }

    try {
      if (page === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const fromDate = formatDateForAPI(startDate);
      const toDate = formatDateForAPI(endDate);

      const response = await apiServices.collection.getCollectionHistory({
        from_date: fromDate,
        to_date: toDate,
        page,
        limit: LIMIT,
      });

      const data = response?.data || {};
      const collections = Array.isArray(data?.collections) ? data.collections : [];
      const pag = response?.pagination || {};
      const statsData = data?.stats || {};

      // Convert to CollectionHistory model instances
      const historyModels = CollectionHistory.fromApiResponseArray(collections);

      if (append) {
        setCollectionHistory((prev) => [...prev, ...historyModels]);
      } else {
        setCollectionHistory(historyModels);
      }

      setStats({
        total_count: statsData.total_count || 0,
        total_amount: statsData.collected_amount ?? statsData.total_amount ?? 0,
        cash_count: statsData.cash_count || 0,
        non_cash_count: statsData.non_cash_count || 0,
        collected_amount: statsData.collected_amount ?? 0,
        expenses_spent: statsData.expenses_spent ?? 0,
        loan_given_amount: statsData.loan_given_amount ?? 0,
        closingbalance: statsData.closingbalance ?? statsData.closing_balance,
      });

      setPagination({
        currentPage: pag.currentPage ?? page,
        hasNextPage: Boolean(pag.hasNextPage),
        totalPages: pag.totalPages ?? 1,
      });
    } catch (err) {
      console.error('Failed to fetch collection history:', err);
      if (page === 1) {
        setError(t('collectionHistory.failedToLoad'));
        setCollectionHistory([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [startDate, endDate]);

  // Load data when dates change
  useEffect(() => {
    if (startDate && endDate && validateDates()) {
      fetchCollectionHistory(1, false);
    }
  }, [startDate, endDate, fetchCollectionHistory]);

  const accountClosingBlocked = useMemo(() => isClosingBalanceDone(stats), [stats]);

  const isTodayDateRange = useMemo(() => {
    const from = formatDateForAPI(startDate);
    const to = formatDateForAPI(endDate);
    const today = getCurrentDateString();
    return from === today && to === today;
  }, [startDate, endDate]);

  const hasCollections = Array.isArray(collectionHistory) && collectionHistory.length >= 1;

  const hasAnyStatsValue = useMemo(() => {
    if (!stats || typeof stats !== 'object') return false;
    const keysToConsider = ['collected_amount', 'expenses_spent', 'loan_given_amount'];
    return keysToConsider.some((key) => {
      const n = Number(stats?.[key]);
      return !Number.isNaN(n) && n > 0;
    });
  }, [stats]);

  const shouldShowAccountClosingButton =
    !accountClosingBlocked && isTodayDateRange && (hasCollections || hasAnyStatsValue);

  // Filter collection history by payment type
  const filteredCollectionHistory = collectionHistory.filter((item) => {
    if (selectedPaymentType === null) return true; // Show all

    const history = item instanceof CollectionHistory ? item : new CollectionHistory(item);
    const paymentType = history.paymentType?.toLowerCase();

    if (selectedPaymentType === 'cash') {
      return paymentType === 'cash';
    } else if (selectedPaymentType === 'online') {
      return paymentType === 'online' || paymentType === 'non_cash';
    }

    return true;
  });

  // Calculate filtered stats
  const filteredStats = {
    total_count: filteredCollectionHistory.length,
    total_amount: filteredCollectionHistory.reduce((sum, item) => {
      const history = item instanceof CollectionHistory ? item : new CollectionHistory(item);
      return sum + (parseFloat(history.amountPaid) || 0);
    }, 0),
    cash_count: filteredCollectionHistory.filter((item) => {
      const history = item instanceof CollectionHistory ? item : new CollectionHistory(item);
      return history.paymentType?.toLowerCase() === 'cash';
    }).length,
    non_cash_count: filteredCollectionHistory.filter((item) => {
      const history = item instanceof CollectionHistory ? item : new CollectionHistory(item);
      const paymentType = history.paymentType?.toLowerCase();
      return paymentType === 'online' || paymentType === 'non_cash';
    }).length,
  };

  // Handle payment type tab change
  const handlePaymentTypeChange = (type) => {
    setSelectedPaymentType(type);
  };

  // Load more function
  const loadMore = useCallback(() => {
    if (loadingMore || !pagination.hasNextPage) return;
    const nextPage = pagination.currentPage + 1;
    fetchCollectionHistory(nextPage, true);
  }, [loadingMore, pagination.hasNextPage, pagination.currentPage, fetchCollectionHistory]);

  // Format currency
  const formatCurrency = (amount) => {
    if (amount == null || amount === '') return '₹0';
    const num = parseFloat(amount);
    return isNaN(num) ? '₹0' : `₹${num.toLocaleString('en-IN')}`;
  };

  const applyClosingFormFromHistoryStats = useCallback(() => {
    setClosingForm({
      expensesSpent:
        stats.expenses_spent != null && stats.expenses_spent !== ''
          ? String(stats.expenses_spent)
          : '0',
      loanGiven:
        stats.loan_given_amount != null && stats.loan_given_amount !== ''
          ? String(stats.loan_given_amount)
          : '0',
      cashBrought: '0',
      collectionCompleted:
        stats.collected_amount != null && stats.collected_amount !== ''
          ? String(stats.collected_amount)
          : '0',
    });
  }, [stats]);

  const openClosingModal = async () => {
    if (accountClosingBlocked) return;
    setShowClosingModal(true);
    setClosingDataLoading(true);
    try {
      const res = await apiServices.dashboard.getTodayStats();
      const raw = dashboardDataFromTodayApi(res);
      const dash = Dashboard.fromApiResponse(raw);
      setClosingForm({
        expensesSpent: String(dash.expenses?.totalAmount ?? 0),
        loanGiven: String(dash.loansGiven?.totalAmount ?? 0),
        cashBrought: String(dash.frontcash?.totalAmount ?? 0),
        collectionCompleted: String(dash.collections?.totalAmount ?? 0),
      });
    } catch (err) {
      console.warn('CollectionHistory: dashboard today for account closing:', err);
      applyClosingFormFromHistoryStats();
    } finally {
      setClosingDataLoading(false);
    }
  };

  const closeClosingModal = () => {
    setShowClosingModal(false);
    setClosingSubmitting(false);
    setClosingDataLoading(false);
  };

  const handleSubmitClosing = async () => {
    if (accountClosingBlocked || closingDataLoading) return;
    setClosingSubmitting(true);
    try {
      await apiServices.upfrontCash.closeOpeningAccount();
      closeClosingModal();
      await fetchCollectionHistory(1, false);
      showSuccess(t('common.success'), t('collectionHistory.closingAccountSuccess'), [
        { text: t('common.ok'), onPress: () => {} },
      ]);
    } catch (err) {
      showError(t('common.error'), getApiErrorMessage(err, t('errors.somethingWentWrong')));
    } finally {
      setClosingSubmitting(false);
    }
  };

  const renderHistoryItem = ({ item }) => {
    const history = item instanceof CollectionHistory ? item : new CollectionHistory(item);
    return (
      <View style={styles.historyItem}>
        <View style={styles.itemHeader}>
          <Text style={styles.receiptNumber}>{history.getReceiptNumber()}</Text>
          <Text style={styles.itemAmount}>{history.getFormattedAmountPaid()}</Text>
        </View>

        <View style={styles.itemDetailsRow}>
          <View style={styles.itemDetailsLeft}>
            <Text style={styles.customerName}>{history.customerName || '—'}</Text>
            <Text style={styles.customerInfo}>
              {history.customerNo ? `${history.customerNo} · ` : ''}
              {history.getPaymentTypeLabel()}
            </Text>
          </View>
          <Text style={styles.itemDate}>{history.getFormattedPaymentDate()}</Text>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ListSkeleton count={2} />
      </View>
    );
  };

  const renderEmpty = () => {
    // Initial load only: spinner (never skeleton). Pagination = skeleton in footer only.
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('collectionHistory.loadingHistory')}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    const filterText = selectedPaymentType === null
      ? t('collectionHistory.inSelectedDateRange')
      : selectedPaymentType === 'cash'
        ? t('collectionHistory.forCashPayments')
        : t('collectionHistory.forOnlinePayments');

    return (
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>{t('collectionHistory.noCollectionsFound')} {filterText}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('collectionHistory.title')}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <Modal
        visible={showClosingModal}
        transparent
        animationType="fade"
        onRequestClose={closeClosingModal}
      >
        <View style={styles.closingModalOverlay}>
          <Pressable
            style={styles.closingModalBackdrop}
            onPress={closeClosingModal}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.closingModalKb}
          >
            <View style={styles.closingModalCard}>
              <View style={styles.closingModalBody}>
                {closingDataLoading ? (
                  <View style={styles.closingModalLoading}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.closingModalLoadingText}>{t('common.loading')}</Text>
                  </View>
                ) : (
                  [
                    { key: 'expensesSpent', label: t('collectionHistory.closingAccountExpenses') },
                    { key: 'loanGiven', label: t('collectionHistory.closingAccountLoanGiven') },
                    { key: 'cashBrought', label: t('collectionHistory.closingAccountCashBrought') },
                    { key: 'collectionCompleted', label: t('collectionHistory.closingAccountCollectionCompleted') },
                  ].map(({ key, label }) => (
                    <View key={key} style={styles.closingField}>
                      <Text style={styles.closingLabel}>{label}</Text>
                      <TextInput
                        style={[styles.closingInput, styles.closingInputReadOnly]}
                        value={closingForm[key]}
                        editable={false}
                        selectTextOnFocus={false}
                        placeholder="0"
                        placeholderTextColor={COLORS.text.tertiary}
                      />
                    </View>
                  ))
                )}
              </View>
              <View style={styles.closingActionsRow}>
                <TouchableOpacity
                  style={styles.closingCancelBtn}
                  onPress={closeClosingModal}
                  disabled={closingSubmitting || closingDataLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.closingCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.closingSubmitBtn,
                    (closingSubmitting || closingDataLoading || accountClosingBlocked) && styles.closingSubmitBtnDisabled,
                  ]}
                  onPress={handleSubmitClosing}
                  disabled={closingSubmitting || closingDataLoading || accountClosingBlocked}
                  activeOpacity={0.85}
                >
                  {closingSubmitting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.closingSubmitText}>{t('collectionHistory.closingAccountSubmit')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <View style={styles.mainBody}>
      <FlatList
        style={styles.mainBodyList}
        data={filteredCollectionHistory}
        keyExtractor={(item) => String(item?.id ?? Math.random())}
        renderItem={renderHistoryItem}
        contentContainerStyle={[
          styles.content,
          {
            // Extra bottom inset was LIST_EXTRA_BOTTOM when fixed “Account closing” bar was shown (block below is commented out).
            paddingBottom: SIZES.padding * 2,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <>
            {/* Date Filter Section */}
            <View style={styles.filterSection}>
              <View style={styles.dateRow}>
                <View style={styles.datePickerContainer}>
                  <DatePicker
                    label={t('collection.startDate')}
                    value={startDate}
                    onValueChange={handleStartDateChange}
                    error={errors.startDate}
                    maximumDate={new Date()}
                  />
                </View>

                <View style={styles.datePickerContainer}>
                  <DatePicker
                    label={t('collection.endDate')}
                    value={endDate}
                    onValueChange={handleEndDateChange}
                    error={errors.endDate}
                    minimumDate={startDate ? new Date(startDate) : undefined}
                    maximumDate={new Date()}
                  />
                </View>
              </View>

              {errors.dateRange && (
                <Text style={styles.errorText}>{errors.dateRange}</Text>
              )}
            </View>

            {/* Summary Card (Cash Receipts / Total Amount + Cash Summary when Cash selected) */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>
                    {selectedPaymentType === null ? t('collectionHistory.totalReceipts') : selectedPaymentType === 'cash' ? t('collectionHistory.cashReceipts') : t('collectionHistory.onlineReceipts')}
                  </Text>
                  <Text style={styles.summaryValue}>{filteredStats.total_count || 0}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('collectionHistory.totalAmount')}</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(filteredStats.total_amount)}</Text>
                </View>
              </View>
              {selectedPaymentType === 'cash' && (
                <>
                  <View style={styles.summaryDivider} />
                  {/* <Text style={styles.cashStatsTitleInCard}>{t('common.cash')} {t('collectionHistory.summary')}</Text> */}
                  <View style={styles.cashStatsHorizontalRow}>
                    <View style={styles.cashStatsColumn}>
                      {/* <View style={styles.cashStatsIconWrap}>
                        <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
                      </View> */}
                      <View style={styles.cashStatsLabelWrap}>
                        <Text style={styles.cashStatLabel} numberOfLines={2}>{t('collectionHistory.collectedAmount')}</Text>
                      </View>
                      <Text style={styles.cashStatValue}>{formatCurrency(stats.collected_amount)}</Text>
                    </View>
                    <View style={styles.cashStatsColumnDivider} />
                    <View style={styles.cashStatsColumn}>
                      {/* <View style={styles.cashStatsIconWrap}>
                        <Ionicons name="card-outline" size={22} color={COLORS.text.secondary} />
                      </View> */}
                      <View style={styles.cashStatsLabelWrap}>
                        <Text style={styles.cashStatLabel} numberOfLines={2}>{t('collectionHistory.expensesSpent')}</Text>
                      </View>
                      <Text style={styles.cashStatValue}>{formatCurrency(stats.expenses_spent)}</Text>
                    </View>
                    <View style={styles.cashStatsColumnDivider} />
                    <View style={styles.cashStatsColumn}>
                      {/* <View style={styles.cashStatsIconWrap}>
                        <Ionicons name="business-outline" size={22} color={COLORS.primary} />
                      </View> */}
                      <View style={styles.cashStatsLabelWrap}>
                        <Text style={styles.cashStatLabel} numberOfLines={2}>{t('collectionHistory.loanGivenAmount')}</Text>
                      </View>
                      <Text style={styles.cashStatValue}>{formatCurrency(stats.loan_given_amount)}</Text>
                    </View>
                  </View>
                </> 
              )}
              {selectedPaymentType === null && (stats.cash_count > 0 || stats.non_cash_count > 0) && (
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{t('collectionHistory.cash')}</Text>
                    <Text style={styles.summarySubValue}>{stats.cash_count || 0}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{t('collectionHistory.nonCash')}</Text>
                    <Text style={styles.summarySubValue}>{stats.non_cash_count || 0}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Payment Type Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  selectedPaymentType === null && styles.tabActive,
                ]}
                onPress={() => handlePaymentTypeChange(null)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    selectedPaymentType === null && styles.tabTextActive,
                  ]}
                >
                  {t('common.all')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  selectedPaymentType === 'cash' && styles.tabActive,
                ]}
                onPress={() => handlePaymentTypeChange('cash')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={selectedPaymentType === 'cash' ? COLORS.white : COLORS.text.secondary}
                  style={styles.tabIcon}
                />
                <Text
                  style={[
                    styles.tabText,
                    selectedPaymentType === 'cash' && styles.tabTextActive,
                  ]}
                >
                  {t('common.cash')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  selectedPaymentType === 'online' && styles.tabActive,
                ]}
                onPress={() => handlePaymentTypeChange('online')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="card-outline"
                  size={18}
                  color={selectedPaymentType === 'online' ? COLORS.white : COLORS.text.secondary}
                  style={styles.tabIcon}
                />
                <Text
                  style={[
                    styles.tabText,
                    selectedPaymentType === 'online' && styles.tabTextActive,
                  ]}
                >
                  {t('common.online')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Collection History List Header */}
            <View style={styles.listSection}>
              <Text style={styles.sectionTitle}>{t('collectionHistory.title')}</Text>
            </View>
          </>
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={filteredCollectionHistory.length > 0 ? renderFooter : null}
      />

      {/*
      Green “Account closing” button (temporarily hidden — restore LIST_EXTRA_BOTTOM in FlatList paddingBottom when re-enabled).
      {shouldShowAccountClosingButton ? (
        <View style={styles.accountClosingBar}>
          <TouchableOpacity
            style={styles.accountClosingBtn}
            onPress={openClosingModal}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('collectionHistory.accountClosingButton')}
          >
            <Text style={styles.accountClosingBtnText}>
              {t('collectionHistory.accountClosingButton')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      */}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  mainBody: {
    flex: 1,
  },
  mainBodyList: {
    flex: 1,
  },
  content: {
    padding: SIZES.padding * 0.5,
    paddingBottom: SIZES.padding * 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 3,
  },
  skeletonWrap: {
    flex: 1,
  },
  loadingText: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    marginTop: SIZES.margin,
  },
  footerLoader: {
    paddingVertical: SIZES.base,
  },
  listContainer: {
    paddingTop: SIZES.base,
  },
  listContainerEmpty: {
    flex: 1,
  },
  filterSection: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding * 0.2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin / 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: SIZES.body2, // Reduced from SIZES.body1
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.margin / 3,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.margin / 100,
  },
  datePickerContainer: {
    flex: 1,
    marginHorizontal: SIZES.base / 3,
  },
  errorText: {
    color: 'red',
    fontSize: SIZES.body3,
    marginBottom: SIZES.base / 2,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    padding: SIZES.base,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin / 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 4,
  },
  summaryValue: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  summarySubValue: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.base,
  },
  cashStatsTitleInCard: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.base * 0.75,
  },
  cashStatsHorizontalRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    // paddingVertical: SIZES.base,
    minHeight: 70,
  },
  cashStatsColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: SIZES.base * 0.25,
  },
  cashStatsIconWrap: {
    height: 28,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cashStatsLabelWrap: {
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    width: '100%',
  },
  cashStatsColumnDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 0,
  },
  cashStatsRowInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base * 0.75,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  cashStatsCard: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin / 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cashStatsTitle: {
    fontSize: SIZES.body2, // Reduced from SIZES.body1
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.base,
  },
  cashStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  cashStatsRowLast: {
    borderBottomWidth: 0,
  },
  cashStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cashStatIcon: {
    marginRight: SIZES.base,
  },
  cashStatLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  cashStatValue: {
    fontSize: SIZES.body2, // Reduced from SIZES.body1
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  listSection: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    paddingBottom: SIZES.base,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SIZES.margin / 3,
  },
  historyItem: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: SIZES.padding / 1.5,
    marginBottom: SIZES.base / 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base / 4,
  },
  itemDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDetailsLeft: {
    flex: 1,
    marginRight: SIZES.base,
  },
  customerInfo: {
    fontSize: SIZES.body4,
    color: COLORS.text.tertiary,
    marginTop: SIZES.base / 4,
  },
  receiptNumber: {
    fontSize: SIZES.body3, // Reduced from SIZES.body2
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  itemAmount: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.primary,
  },
  customerName: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 8,
  },
  itemDate: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
  },
  noDataContainer: {
    padding: SIZES.padding * 1.5,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin / 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SIZES.base / 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.base,
    borderRadius: SIZES.radius * 0.75,
    backgroundColor: COLORS.lightGray,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabIcon: {
    marginRight: SIZES.base / 2,
  },
  tabText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  accountClosingBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: SIZES.base,
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  accountClosingBtn: {
    backgroundColor: COLORS.success,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.padding,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  accountClosingBtnText: {
    color: COLORS.white,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  closingModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  closingModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  closingModalKb: {
    width: '90%',
    maxWidth: 400,
    zIndex: 1,
  },
  closingModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  closingModalBody: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.base,
  },
  closingField: {
    marginBottom: SIZES.base + 2,
  },
  closingLabel: {
    fontSize: SIZES.body3,
    fontWeight: '500',
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  closingInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding * 0.75,
    paddingVertical: 10,
    fontSize: SIZES.body3,
    color: COLORS.black,
    backgroundColor: COLORS.white,
    minHeight: 44,
  },
  closingInputReadOnly: {
    backgroundColor: COLORS.lightGray,
    color: COLORS.text.secondary,
  },
  closingModalLoading: {
    paddingVertical: SIZES.padding * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closingModalLoadingText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
  },
  closingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: SIZES.radius * 2,
    borderBottomRightRadius: SIZES.radius * 2,
  },
  closingCancelBtn: {
    flex: 1,
    borderRadius: SIZES.radius,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.lightGray,
  },
  closingCancelText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  closingSubmitBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  closingSubmitBtnDisabled: {
    opacity: 0.7,
  },
  closingSubmitText: {
    color: COLORS.white,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
});

export default CollectionHistoryScreen;

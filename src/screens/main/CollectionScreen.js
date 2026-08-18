import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, InteractionManager, Keyboard, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getImageUrl } from '../../api/apiClient';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import PaginationListFooter from '../../components/common/PaginationListFooter';
import { COLORS, SIZES } from '../../constants/theme';
import { DEBOUNCE_MS_DEFAULT } from '../../hooks/useDebouncedValue';
import Collection from '../../models/Collection';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showAlert, showError, showInfo, showSuccess, showWarning } from '../../utils/alertService';
import { formatCurrency } from '../../utils/amountFormatters';
import { guardAttendanceGatedEntry } from '../../utils/attendanceEntryGate';
import { formatDateForAPI, formatDisplayDate, formatDisplayDateWithDay, getCalendarDate, getCurrentDateString } from '../../utils/dateFormatter';
import { safeGoBack } from '../../utils/navigationHelpers';

const openIosAppSettings = async () => {
  try {
    await Linking.openURL('app-settings:');
  } catch {
    await Linking.openSettings();
  }
};

const formatAmount = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? '—' : `₹${num.toLocaleString('en-IN')}`;
};

const formatCurrencyOrDash = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return '—';
  return formatCurrency(val);
};

const UNPAID_LIMIT = 10;
const PAID_LIMIT = 10;
const ANDROID_NAV_BAR_HEIGHT = 56;
const KEYBOARD_FALLBACK_HEIGHT = 280;

const getBottomInset = (insets) => (
  Platform.OS === 'android'
    ? Math.max(insets.bottom, ANDROID_NAV_BAR_HEIGHT)
    : Math.max(insets.bottom, SIZES.base)
);

const parseCollectionsFromResponse = (response) => {
  const raw = response?.data?.collections ?? response?.collections;
  return Array.isArray(raw) ? raw : [];
};

const areListPanePropsEqual = (prev, next) =>
  prev.isActive === next.isActive &&
  prev.data === next.data &&
  prev.loading === next.loading &&
  prev.loadingMore === next.loadingMore &&
  prev.hasNextPage === next.hasNextPage &&
  prev.refreshing === next.refreshing &&
  prev.onRefresh === next.onRefresh;

const CollectionTabBar = memo(function CollectionTabBar({
  activeTab,
  onTabPress,
  pendingLabel,
  paidLabel,
}) {
  return (
    <View style={styles.tabBar}>
      <Pressable
        style={[styles.tabItem, activeTab === 'pending' && styles.tabItemActive]}
        onPress={() => onTabPress('pending')}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
      >
        <Text style={[styles.tabLabel, activeTab === 'pending' && styles.tabLabelActive]}>
          {pendingLabel}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.tabItem, activeTab === 'paid' && styles.tabItemActive]}
        onPress={() => onTabPress('paid')}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
      >
        <Text style={[styles.tabLabel, activeTab === 'paid' && styles.tabLabelActive]}>
          {paidLabel}
        </Text>
      </Pressable>
    </View>
  );
});

const CollectionListPane = memo(function CollectionListPane({
  isActive,
  data,
  loading,
  loadingMore,
  hasNextPage,
  renderItem,
  keyExtractor,
  ListEmptyComponent,
  onEndReached,
  onLayout,
  onContentSizeChange,
  contentContainerStyle,
  ListFooterComponent,
  refreshing,
  onRefresh,
}) {
  return (
    <View
      style={[StyleSheet.absoluteFillObject, !isActive && styles.hiddenTab]}
      pointerEvents={isActive ? 'box-none' : 'none'}
      collapsable={false}
    >
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={isActive ? onEndReached : undefined}
        onEndReachedThreshold={0.15}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
      />
    </View>
  );
}, areListPanePropsEqual);

const CollectionScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomInset = getBottomInset(insets);
  const [searchText, setSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState(getCalendarDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingList, setPendingList] = useState([]);
  const [paidList, setPaidList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreUnpaid, setLoadingMoreUnpaid] = useState(false);
  const [loadingPaid, setLoadingPaid] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMorePaid, setLoadingMorePaid] = useState(false);
  const [error, setError] = useState(null);
  const [paidError, setPaidError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [loanTypeTab, setLoanTypeTab] = useState('weekly'); // daily | weekly tab UI
  const [tabSwitchLoading, setTabSwitchLoading] = useState(false);
  const deferredTab = useDeferredValue(activeTab);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const loanTypeTabRef = useRef(loanTypeTab);
  loanTypeTabRef.current = loanTypeTab;
  /** loan_type IDs from GET /loan-type/active/list — Daily=2, Weekly=1 */
  const loanTypeIdsRef = useRef({ daily: 2, weekly: 1 });
  const [loanTypeCounts, setLoanTypeCounts] = useState({
    pending: { daily: 0, weekly: 0 },
    paid: { daily: 0, weekly: 0 },
  });
  const [unpaidPagination, setUnpaidPagination] = useState({
    currentPage: 1,
    hasNextPage: false,
    totalPages: 1,
    totalRecords: 0,
  });
  const [paidPagination, setPaidPagination] = useState({
    currentPage: 1,
    hasNextPage: false,
    totalPages: 1,
    totalRecords: 0,
  });
  const searchDebounceRef = useRef(null);
  const searchTextRef = useRef(searchText);
  searchTextRef.current = searchText;
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const pendingContentHeightRef = useRef(0);
  const pendingContainerHeightRef = useRef(0);
  const paidContentHeightRef = useRef(0);
  const paidContainerHeightRef = useRef(0);
  const unpaidLoadMoreLockRef = useRef(false);
  const paidLoadMoreLockRef = useRef(false);

  // Payment collection modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [paymentMode, setPaymentMode] = useState('Cash'); // 'Cash' or 'Online'
  const [collectedAmount, setCollectedAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const collectedAmountRef = useRef(null);
  const remarksRef = useRef(null);
  const paymentScrollRef = useRef(null);
  const amountFieldYRef = useRef(0);
  const remarksFieldYRef = useRef(0);
  const lastKeyboardHeightRef = useRef(KEYBOARD_FALLBACK_HEIGHT);
  const [paymentKeyboardHeight, setPaymentKeyboardHeight] = useState(0);
  const [paymentErrors, setPaymentErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoModalUri, setPhotoModalUri] = useState(null);

  const shouldAllowPaymentWhenBalanceZero = (collection) => {
    const balanceAmount = parseFloat(collection?.balanceAmount) || 0;
    const completedCount = parseInt(collection?.completedCount) || 0;

    // If balance is not zero, always allow payment
    if (balanceAmount !== 0) {
      return true;
    }

    // If balance is zero, only allow payment if completed_count is 0
    return completedCount === 0;
  };

  const isAlreadyCollectedForSelectedDate = (collection) => {
    if (!collection.isPaid()) return false;
    const selected = formatDateForAPI(selectedDate);
    const collectionDate = formatDateForAPI(collection.collectionDate);
    return Boolean(selected && collectionDate && selected === collectionDate);
  };

  /** Optional search filters: name → search, customer id → customer_id, phone → customer_phone */
  const buildSearchParams = useCallback((searchQuery) => {
    const trimmed = (searchQuery || '').trim();
    if (!trimmed) return {};

    const digitsOnly = trimmed.replace(/\s/g, '');
    const isNumeric = /^\d+$/.test(digitsOnly);

    if (isNumeric) {
      // 10+ digits treated as phone number; shorter numeric as customer id
      if (digitsOnly.length >= 10) {
        return { customer_phone: digitsOnly };
      }
      return { customer_id: digitsOnly };
    }

    // Name or customer number (e.g. BA126)
    return { search: trimmed };
  }, []);

  const fetchUnpaidCollections = useCallback(async (page = 1, append = false, searchQuery = '', collectionDate = null, skipPageLoader = false) => {
    const requestedLoanType = loanTypeTabRef.current;
    try {
      if (page === 1 && !append && !skipPageLoader) {
        setLoading(true);
        setError(null);
        unpaidLoadMoreLockRef.current = false;
      }

      const dateToUse = collectionDate || selectedDateRef.current;
      const dateString = formatDateForAPI(dateToUse);
      const response = await apiServices.collection.getUnpaidCollections({
        page,
        limit: UNPAID_LIMIT,
        collection_date: dateString,
        loan_type: loanTypeIdsRef.current[requestedLoanType],
        ...buildSearchParams(searchQuery),
      });

      const list = parseCollectionsFromResponse(response);
      const models = Collection.fromApiResponseArray(list);
      const pag = response?.pagination || {};

      setPendingList((prev) => (append ? [...prev, ...models] : models));
      setUnpaidPagination((prev) => ({
        currentPage: pag.currentPage ?? page,
        hasNextPage: Boolean(pag.hasNextPage),
        totalPages: pag.totalPages ?? 1,
        totalRecords: pag.totalRecords != null ? pag.totalRecords : (append ? prev.totalRecords : models.length),
      }));
      if (page === 1 && !append && !skipPageLoader) {
        const count = Number(pag.totalRecords ?? models.length) || 0;
        setLoanTypeCounts((prev) => ({
          ...prev,
          pending: { ...prev.pending, [requestedLoanType]: count },
        }));
      }
    } catch (err) {
      if (page === 1 && !append) {
        showError(t('common.error'), getApiErrorMessage(err, t('collection.failedToLoad')));
        setError(null);
        setPendingList([]);
      }
    } finally {
      if (page === 1 && !append) {
        setLoading(false);
      } else {
        setLoadingMoreUnpaid(false);
        unpaidLoadMoreLockRef.current = false;
      }
    }
  }, [buildSearchParams, t]);

  const fetchPaidCollections = useCallback(async (page = 1, append = false, searchQuery = '', collectionDate = null, skipPageLoader = false) => {
    const requestedLoanType = loanTypeTabRef.current;
    try {
      if (page === 1 && !append && !skipPageLoader) {
        setLoadingPaid(true);
        setPaidError(null);
        paidLoadMoreLockRef.current = false;
      }

      const dateToUse = collectionDate || selectedDateRef.current;
      const dateString = formatDateForAPI(dateToUse);
      const response = await apiServices.collection.getPaidCollections({
        page,
        limit: PAID_LIMIT,
        collection_date: dateString,
        loan_type: loanTypeIdsRef.current[requestedLoanType],
        ...buildSearchParams(searchQuery),
      });
      const list = parseCollectionsFromResponse(response);
      const models = Collection.fromApiResponseArray(list);
      const pag = response?.pagination || {};

      setPaidList((prev) => (append ? [...prev, ...models] : models));
      setPaidPagination((prev) => ({
        currentPage: pag.currentPage ?? page,
        hasNextPage: Boolean(pag.hasNextPage),
        totalPages: pag.totalPages ?? 1,
        totalRecords: pag.totalRecords != null ? pag.totalRecords : (append ? prev.totalRecords : models.length),
      }));
      if (page === 1 && !append && !skipPageLoader) {
        const count = Number(pag.totalRecords ?? models.length) || 0;
        setLoanTypeCounts((prev) => ({
          ...prev,
          paid: { ...prev.paid, [requestedLoanType]: count },
        }));
      }
    } catch (err) {
      if (page === 1 && !append) {
        showError(t('common.error'), getApiErrorMessage(err, t('collection.failedToLoad')));
        setPaidError(null);
        setPaidList([]);
      }
    } finally {
      if (page === 1 && !append) {
        setLoadingPaid(false);
      } else {
        setLoadingMorePaid(false);
        paidLoadMoreLockRef.current = false;
      }
    }
  }, [buildSearchParams, t]);

  const fetchOtherLoanTypeCounts = useCallback(async (searchQuery = '', collectionDate = null) => {
    const currentType = loanTypeTabRef.current;
    const otherType = currentType === 'daily' ? 'weekly' : 'daily';
    const dateString = formatDateForAPI(collectionDate || selectedDateRef.current);
    const params = {
      page: 1,
      limit: 1,
      collection_date: dateString,
      loan_type: loanTypeIdsRef.current[otherType],
      ...buildSearchParams(searchQuery),
    };

    const [pendingResult, paidResult] = await Promise.allSettled([
      apiServices.collection.getUnpaidCollections(params),
      apiServices.collection.getPaidCollections(params),
    ]);

    setLoanTypeCounts((prev) => {
      const next = {
        pending: { ...prev.pending },
        paid: { ...prev.paid },
      };
      if (pendingResult.status === 'fulfilled') {
        const list = parseCollectionsFromResponse(pendingResult.value);
        next.pending[otherType] =
          Number(pendingResult.value?.pagination?.totalRecords ?? list.length) || 0;
      }
      if (paidResult.status === 'fulfilled') {
        const list = parseCollectionsFromResponse(paidResult.value);
        next.paid[otherType] =
          Number(paidResult.value?.pagination?.totalRecords ?? list.length) || 0;
      }
      return next;
    });
  }, [buildSearchParams]);

  const loadBothCollections = useCallback(
    (searchQuery = '', collectionDate = null) => {
      fetchUnpaidCollections(1, false, searchQuery, collectionDate);
      fetchPaidCollections(1, false, searchQuery, collectionDate);
      fetchOtherLoanTypeCounts(searchQuery, collectionDate);
    },
    [fetchUnpaidCollections, fetchPaidCollections, fetchOtherLoanTypeCounts]
  );

  const refreshListsForFilters = useCallback(
    (searchQuery = '', collectionDate = null) => {
      setLoading(true);
      setLoadingPaid(true);
      loadBothCollections(searchQuery, collectionDate);
    },
    [loadBothCollections]
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchUnpaidCollections(1, false, searchTextRef.current, selectedDateRef.current, true),
        fetchPaidCollections(1, false, searchTextRef.current, selectedDateRef.current, true),
        fetchOtherLoanTypeCounts(searchTextRef.current, selectedDateRef.current),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, fetchUnpaidCollections, fetchPaidCollections, fetchOtherLoanTypeCounts]);

  const loadMoreUnpaid = useCallback(() => {
    if (activeTab !== 'pending') return;
    if (
      loading ||
      loadingMoreUnpaid ||
      unpaidLoadMoreLockRef.current ||
      !unpaidPagination.hasNextPage
    ) {
      return;
    }
    unpaidLoadMoreLockRef.current = true;
    setLoadingMoreUnpaid(true);
    const nextPage = unpaidPagination.currentPage + 1;
    fetchUnpaidCollections(nextPage, true, searchTextRef.current, selectedDateRef.current);
  }, [activeTab, loading, loadingMoreUnpaid, unpaidPagination, fetchUnpaidCollections]);

  const loadMorePaid = useCallback(() => {
    if (activeTab !== 'paid') return;
    if (
      loadingPaid ||
      loadingMorePaid ||
      paidLoadMoreLockRef.current ||
      !paidPagination.hasNextPage
    ) {
      return;
    }
    paidLoadMoreLockRef.current = true;
    setLoadingMorePaid(true);
    const nextPage = paidPagination.currentPage + 1;
    fetchPaidCollections(nextPage, true, searchTextRef.current, selectedDateRef.current);
  }, [activeTab, loadingPaid, loadingMorePaid, paidPagination, fetchPaidCollections]);

  /** When first page is shorter than the list viewport, onEndReached may not fire — load next page until scrollable or done. */
  const maybeLoadMoreUnpaidIfShort = useCallback(() => {
    if (
      loading ||
      loadingMoreUnpaid ||
      !unpaidPagination.hasNextPage ||
      pendingContentHeightRef.current <= 0 ||
      pendingContainerHeightRef.current <= 0
    ) {
      return;
    }
    if (pendingContentHeightRef.current <= pendingContainerHeightRef.current) {
      loadMoreUnpaid();
    }
  }, [loading, loadingMoreUnpaid, unpaidPagination.hasNextPage, loadMoreUnpaid]);

  const maybeLoadMorePaidIfShort = useCallback(() => {
    if (
      loadingPaid ||
      loadingMorePaid ||
      !paidPagination.hasNextPage ||
      paidContentHeightRef.current <= 0 ||
      paidContainerHeightRef.current <= 0
    ) {
      return;
    }
    if (paidContentHeightRef.current <= paidContainerHeightRef.current) {
      loadMorePaid();
    }
  }, [loadingPaid, loadingMorePaid, paidPagination.hasNextPage, loadMorePaid]);

  useEffect(() => {
    if (!loading && pendingList.length > 0) {
      maybeLoadMoreUnpaidIfShort();
    }
  }, [loading, pendingList.length, unpaidPagination.hasNextPage, maybeLoadMoreUnpaidIfShort]);

  useEffect(() => {
    if (!loadingPaid && paidList.length > 0) {
      maybeLoadMorePaidIfShort();
    }
  }, [loadingPaid, paidList.length, paidPagination.hasNextPage, maybeLoadMorePaidIfShort]);

  // Initial load: fetch loan type IDs, then unpaid + paid lists
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const list = await apiServices.loan.getLoanTypes();
          (Array.isArray(list) ? list : []).forEach((item) => {
            const name = String(item?.loan_type || '').toLowerCase();
            if (name === 'daily' && item?.id != null) {
              loanTypeIdsRef.current.daily = item.id;
            }
            if (name === 'weekly' && item?.id != null) {
              loanTypeIdsRef.current.weekly = item.id;
            }
          });
        } catch (e) {
          // keep defaults daily=2, weekly=1
        }
        loadBothCollections(searchTextRef.current, selectedDate);
      };
      load();
    }, [loadBothCollections, selectedDate])
  );

  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      refreshListsForFilters(searchText, selectedDateRef.current);
    }, DEBOUNCE_MS_DEFAULT);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchText, refreshListsForFilters]);

  // Handle date change
  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) {
        setSelectedDate(date);
        // Fetch data with new date
        refreshListsForFilters(searchText, date);
      }
    } else {
      // iOS - update date as user scrolls, but don't fetch until "Done" is pressed
      if (date) {
        setSelectedDate(date);
      }
    }
  };

  const isSelectedDateToday = formatDateForAPI(selectedDate) === getCurrentDateString();
  const dailyLoanTypeCount = loanTypeCounts[activeTab].daily;
  const weeklyLoanTypeCount = loanTypeCounts[activeTab].weekly;
  const showListOverlay = tabSwitchLoading || loading || loadingPaid;

  const openPaymentModal = (collection) => {
    setSelectedCollection(collection);
    setPaymentMode('Cash');
    setCollectedAmount('');
    setRemarks('');
    setPaymentErrors({});
    setShowPaymentModal(true);
  };

  const handleItemPress = (item) => {
    if (!guardAttendanceGatedEntry(t)) return;

    const collection = item instanceof Collection ? item : new Collection(item);

    // if (!isSelectedDateToday) {
    //   showWarning(
    //     'Collection payment',
    //     "Collection payment can only be recorded for the current date. Please select today's date to collect payment."
    //   );
    //   return;
    // }

    const balanceAmount = parseFloat(collection.balanceAmount) || 0;
    if (balanceAmount <= 0) {
      if (!shouldAllowPaymentWhenBalanceZero(collection)) {
        showInfo('', t('collection.noBalanceToCollect'));
        return;
      }
    }

    if (isAlreadyCollectedForSelectedDate(collection)) {
      showInfo('', t('collection.alreadyCollectedToday'));
      return;
    }

    openPaymentModal(collection);
  };

  const handlePhonePress = (phoneNumber) => {
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.openURL(phoneUrl)
      .then((supported) => {
        if (!supported) {
          showError('Error', 'Phone dialer not available');
        }
      })
      .catch((err) => {
        showError('Error', 'Could not open phone dialer');
      });
  };

  const handleMapPress = (address) => {
    if (!address || !address.trim()) {
      showError('Error', 'Address not available');
      return;
    }

    // Encode the address for URL
    const encodedAddress = encodeURIComponent(address.trim());

    // Try Google Maps app first, fallback to web
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    const googleMapsAppUrl = `comgooglemaps://?q=${encodedAddress}`;

    // Try to open Google Maps app, fallback to web
    Linking.canOpenURL(googleMapsAppUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(googleMapsAppUrl);
        } else {
          return Linking.openURL(googleMapsUrl);
        }
      })
      .catch((err) => {
        // Fallback to web version
        Linking.openURL(googleMapsUrl).catch((fallbackErr) => {
          showError('Error', 'Could not open Google Maps. Please check if Google Maps is installed.');
        });
      });
  };

  const handleLoanInfoPress = (collection) => {
    if (!collection?.loanId) {
      return;
    }
    navigation.navigate('LoanScreen', {
      loan: { id: collection.loanId },
      customerData: {
        name: collection.customerName ?? '',
        phone: collection.customerPhone ?? '',
        loanId: String(collection.loanId),
        initialAmount: collection.loanAmount ?? '',
      },
    });
  };

  const validatePaymentForm = () => {
    const errors = {};

    if (!collectedAmount || collectedAmount.trim() === '') {
      errors.collectedAmount = t('collection.collectedAmountRequired');
    } else {
      const amount = parseFloat(collectedAmount);
      if (isNaN(amount) || amount <= 0) {
        errors.collectedAmount = t('collection.collectedAmountInvalid');
      } else if (selectedCollection) {
        // Check if collected amount exceeds balance amount
        const balanceAmount = parseFloat(selectedCollection.balanceAmount) || 0;
        const allowExceedWhenInitialPayment = shouldAllowPaymentWhenBalanceZero(selectedCollection);
        if (!allowExceedWhenInitialPayment && amount > balanceAmount) {
          errors.collectedAmount = `${t('collection.collectedAmountExceed')} (${selectedCollection.getFormattedBalanceAmount()})`;
        }
      }
    }

    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getCurrentLocation = async (retryCount = 0) => {
    try {
      const promptLocationServicesDisabled = () =>
        new Promise((resolve) => {
          showAlert({
            type: 'warning',
            title: t('collection.locationServicesDisabled'),
            message: `${t('collection.enableLocation')}\n\n${t('collection.enableLocationThenRetry')}`,
            buttons: [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve('cancel') },
              { text: t('collection.turnOnLocation'), onPress: () => resolve('turnOn') },
              { text: t('common.retry'), onPress: () => resolve('retry') },
            ],
          });
        });

      let afterTurnOnNeedRetry = false;

      for (; ;) {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (servicesEnabled && !afterTurnOnNeedRetry) {
          break;
        }

        const action = await promptLocationServicesDisabled();
        if (action === 'cancel') {
          throw new Error('Location services are disabled - user cancelled');
        }
        if (action === 'turnOn') {
          afterTurnOnNeedRetry = true;
          if (Platform.OS === 'android') {
            try {
              await Location.enableNetworkProviderAsync();
            } catch {
              // User dismissed the system dialog or resolution failed
            }
          } else {
            await openIosAppSettings();
          }
          continue;
        }
        if (action === 'retry') {
          if (await Location.hasServicesEnabledAsync()) {
            afterTurnOnNeedRetry = false;
            break;
          }
          showWarning(t('collection.locationServicesDisabled'), t('collection.locationStillDisabled'));
          continue;
        }
      }

      let { status: permStatus } = await Location.getForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        permStatus = req.status;
      }

      const promptPermissionDenied = () =>
        new Promise((resolve) => {
          showAlert({
            type: 'warning',
            title: t('collection.locationPermissionDenied'),
            message: `${t('collection.enableLocationPermissionBody')}\n\n${t('collection.permissionThenRetry')}`,
            buttons: [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve('cancel') },
              { text: t('collection.openAppSettings'), onPress: () => resolve('settings') },
              { text: t('common.retry'), onPress: () => resolve('retry') },
            ],
          });
        });

      let afterSettingsNeedRetry = false;

      while (permStatus !== 'granted' || afterSettingsNeedRetry) {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted' && !afterSettingsNeedRetry) {
          break;
        }

        const action = await promptPermissionDenied();
        if (action === 'cancel') {
          throw new Error('Location permission denied - user cancelled');
        }
        if (action === 'settings') {
          afterSettingsNeedRetry = true;
          if (Platform.OS === 'ios') {
            await openIosAppSettings();
          } else {
            await Linking.openSettings();
          }
          permStatus = (await Location.getForegroundPermissionsAsync()).status;
          continue;
        }
        if (action === 'retry') {
          permStatus = (await Location.getForegroundPermissionsAsync()).status;
          if (permStatus === 'granted') {
            afterSettingsNeedRetry = false;
            break;
          }
          showWarning(t('collection.locationPermissionDenied'), t('collection.permissionStillDenied'));
          continue;
        }
      }

      // Get current location with retry logic
      try {
        const locationData = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 20000, // 20 seconds timeout
          maximumAge: 10000, // Accept cached location up to 10 seconds old
          mayShowUserSettingsDialog: Platform.OS === 'android',
        });

        return {
          latitude: locationData.coords.latitude,
          longitude: locationData.coords.longitude,
        };
      } catch (locationError) {
        // If getting position fails, it might be because GPS is still acquiring signal
        if (retryCount < 2) {
          console.log('Location acquisition failed, retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return getCurrentLocation(retryCount + 1);
        }
        throw locationError;
      }
    } catch (error) {
      // Only log if it's not a user cancellation
      if (!error.message?.includes('user cancelled')) {
      }
      throw error;
    }
  };

  const handleSubmitPayment = async () => {
    if (!guardAttendanceGatedEntry(t)) return;

    if (!validatePaymentForm()) {
      return;
    }

    if (!selectedCollection || !selectedCollection.id) {
      showError(t('common.error'), t('collection.noCollections'));
      return;
    }

    if (isAlreadyCollectedForSelectedDate(selectedCollection)) {
      showInfo('', t('collection.alreadyCollectedToday'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current location
      let latitude = null;
      let longitude = null;

      try {
        const location = await getCurrentLocation();
        latitude = location.latitude;
        longitude = location.longitude;
      } catch (locationError) {
        // Check if user cancelled or if it's a permission/service issue
        const isUserCancelled = locationError.message?.includes('user cancelled');

        if (!isUserCancelled) {
          // Ask user if they want to continue without location
          const shouldContinue = await new Promise((resolve) => {
            showAlert({
              type: 'warning',
              title: t('collection.locationError'),
              message: t('collection.locationError'),
              buttons: [
                { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
                { text: t('common.ok'), onPress: () => resolve(true) },
              ],
            });
          });

          if (!shouldContinue) {
            setIsSubmitting(false);
            return;
          }
        } else {
          // User cancelled, stop submission
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        amount_paid: parseFloat(collectedAmount),
        payment_type: paymentMode, // Add payment mode (Cash or Online)
      };

      // Add location if available
      if (latitude !== null && longitude !== null) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      // Add remarks if provided
      if (remarks && remarks.trim()) {
        payload.notes = remarks.trim();
      }

      await apiServices.collection.updateAmount(selectedCollection.id, payload);

      showSuccess(t('common.success'), t('success.collectionUpdated'), [
        {
          text: t('common.ok'),
          onPress: () => {
            setShowPaymentModal(false);
            loadBothCollections(searchText, selectedDate);
          },
        },
      ]);
    } catch (err) {
      showError(t('common.error'), getApiErrorMessage(err, t('errors.somethingWentWrong')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePaymentModal = () => {
    Keyboard.dismiss();
    setPaymentKeyboardHeight(0);
    setShowPaymentModal(false);
    setSelectedCollection(null);
    setPaymentMode('Cash');
    setCollectedAmount('');
    setRemarks('');
    setPaymentErrors({});
  };

  useEffect(() => {
    if (!showPaymentModal) {
      setPaymentKeyboardHeight(0);
      return undefined;
    }

    const applyKeyboardHeight = (event) => {
      const height = event?.endCoordinates?.height ?? 0;
      if (height <= 0) return;
      lastKeyboardHeightRef.current = height;
      setPaymentKeyboardHeight(height);
    };

    const showSubs = [
      Keyboard.addListener('keyboardDidShow', applyKeyboardHeight),
      Keyboard.addListener('keyboardWillShow', applyKeyboardHeight),
    ];
    const hideSubs = [
      Keyboard.addListener('keyboardDidHide', () => setPaymentKeyboardHeight(0)),
      Keyboard.addListener('keyboardWillHide', () => setPaymentKeyboardHeight(0)),
    ];

    return () => {
      showSubs.forEach((sub) => sub.remove());
      hideSubs.forEach((sub) => sub.remove());
    };
  }, [showPaymentModal]);

  const scrollPaymentToField = (y) => {
    paymentScrollRef.current?.scrollTo({
      y: Math.max(0, y - 12),
      animated: true,
    });
  };

  const ensurePaymentScrollRoom = () => {
    setPaymentKeyboardHeight((current) => (
      current > 0 ? current : lastKeyboardHeightRef.current || KEYBOARD_FALLBACK_HEIGHT
    ));
  };

  const handleTabPress = useCallback((tab) => {
    if (activeTabRef.current === tab) return;
    setActiveTab(tab);
    setTabSwitchLoading(true);
  }, []);

  const handleLoanTypeTabPress = useCallback((tab) => {
    if (loanTypeTabRef.current === tab) return;
    setLoanTypeTab(tab);
    loanTypeTabRef.current = tab;
    loadBothCollections(searchTextRef.current, selectedDateRef.current);
  }, [loadBothCollections]);

  useEffect(() => {
    if (!tabSwitchLoading || activeTab !== deferredTab) return;

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTabSwitchLoading(false);
      });
    });

    return () => task.cancel();
  }, [tabSwitchLoading, activeTab, deferredTab]);

  const renderUnpaidFooter = () => (
    <PaginationListFooter
      loadingMore={loadingMoreUnpaid}
      hasNextPage={unpaidPagination.hasNextPage}
    />
  );

  const renderPaidFooter = () => (
    <PaginationListFooter
      loadingMore={loadingMorePaid}
      hasNextPage={paidPagination.hasNextPage}
    />
  );

  const renderPendingEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('collection.loadingCollections')}</Text>
        </View>
      );
    }
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>{t('collection.noPendingCollections')}</Text>
      </View>
    );
  };

  const renderPaidEmpty = () => {
    if (loadingPaid) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>{t('collection.noPaidCollections')}</Text>
      </View>
    );
  };

  const openPhotoModal = (imagePath) => {
    const uri = getImageUrl(imagePath);
    if (uri) {
      setPhotoModalUri(uri);
      setPhotoModalVisible(true);
    }
  };

  const renderCollectionActionIcons = (collection) => (
    <View style={styles.collectionCardIconsRow}>
      {collection.customerAddress ? (
        <TouchableOpacity
          style={styles.collectionCardIconButton}
          onPress={(e) => {
            e.stopPropagation();
            handleMapPress(collection.customerAddress);
          }}
        >
          <Ionicons name="map-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      ) : null}
      {collection.customerPhone ? (
        <TouchableOpacity
          style={styles.collectionCardIconButton}
          onPress={(e) => {
            e.stopPropagation();
            handlePhonePress(collection.customerPhone);
          }}
        >
          <Ionicons name="call" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      ) : null}
      {collection.loanId ? (
        <TouchableOpacity
          style={styles.collectionCardIconButton}
          onPress={(e) => {
            e.stopPropagation();
            handleLoanInfoPress(collection);
          }}
        >
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderCollectionItem = ({ item }) => {
    const collection = item instanceof Collection ? item : new Collection(item);
    const customerName = String(collection.customerName ?? '').trim();
    const isLongCustomerName = customerName.length > 12;
    const displayId = collection.customerNo ?? collection.customerId ?? '—';

    return (
      <TouchableOpacity
        style={[styles.listItem, collection.isPending && styles.listItemPending, collection.isHighPendingCount && styles.listItemHighPending]}
        onPress={() => handleItemPress(collection)}
        activeOpacity={0.7}
      >
        <View style={styles.collectionCardHeader}>
          <TouchableOpacity
            style={styles.collectionCardPhotoWrap}
            onPress={(e) => {
              e.stopPropagation();
              openPhotoModal(collection.customerPhoto);
            }}
            activeOpacity={0.8}
          >
            {collection.customerPhoto ? (
              <Image
                source={{ uri: getImageUrl(collection.customerPhoto) }}
                style={styles.collectionCardPhoto}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={require('../../../assets/images/favicon.png')}
                style={styles.collectionCardPhoto}
                resizeMode="cover"
              />
            )}
          </TouchableOpacity>
          <View style={styles.collectionCardHeaderBody}>
            {isLongCustomerName ? (
              <>
                <Text style={styles.collectionCardNameLine} numberOfLines={2}>
                  {displayId} - {customerName || '—'}
                </Text>
                {renderCollectionActionIcons(collection)}
              </>
            ) : (
              <View style={styles.collectionCardNameRow}>
                <Text
                  style={[styles.collectionCardNameLine, styles.collectionCardNameLineInline]}
                  numberOfLines={1}
                >
                  {displayId} - {customerName || '—'}
                </Text>
                {renderCollectionActionIcons(collection)}
              </View>
            )}
          </View>
        </View>
        <View style={styles.itemDivider} />
        <View style={styles.itemRow}>
          <Text style={styles.itemAssets}>
            {t('loan.week')} {collection.collectionWeek ?? '—'} · {collection.getFormattedCollectionDate()}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: collection.getStatusColor() }]}>
            <Text style={styles.statusText}>{collection.getStatusText()}</Text>
          </View>
        </View>
        <View style={styles.itemRow}>
          <Text style={styles.itemMetaLeft}>{t('loan.loanPeriod')}:</Text>
          <Text style={styles.itemMetaRight}>{collection.loanPeriod ?? '—'}/{collection.loanTypeName ?? '—'}</Text>
        </View>

        {/* Loan due status row hidden per product request
        <View style={styles.itemRow}>
          <Text style={styles.itemMetaLeft}>{t('collection.loanDueStatus')}:</Text>
          <Text style={styles.itemMetaRight}>
            {(() => {
              return `${collection.completed_collection_count ?? collection.completedCount ?? 0}(${collection.pending_collection_count ?? collection.pendingCount ?? 0})/${collection.current_collection_due_count ?? collection.totalCount ?? 0}`;
            })()}
          </Text>
        </View>
        */}

        <View style={styles.itemRow}>
          <Text style={styles.itemMetaLeft}>{t('loan.interestAmount')}:</Text>
          <Text style={styles.itemMetaRight}>{formatCurrencyOrDash(collection.intrestAmount)}</Text>
        </View>
        <View style={styles.itemRow}>
          <Text style={styles.itemMetaLeft}>{t('loan.processingFees')}:</Text>
          <Text style={styles.itemMetaRight}>{formatCurrencyOrDash(collection.processingFees)}</Text>
        </View>
        {collection.extraAmount != null && collection.extraAmount !== '' && (
          <View style={styles.itemRow}>
            <Text style={[styles.itemMetaLeft, styles.extraAmountText]}>{t('collection.extraAmount')}:</Text>
            <Text style={[styles.itemMetaRight, styles.extraAmountText]}>
              {formatCurrencyOrDash(collection.extraAmount)}
            </Text>
          </View>
        )}
        <View style={styles.itemRow}>
          <Text style={styles.itemMetaLeft}>{t('loan.paid')}: {collection.getFormattedAmountPaid()}</Text>
          <Text style={styles.itemMetaRight}>{t('loan.balance')}: {collection.getFormattedBalanceAmount()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header
        title={t('collection.title')}
        showBackButton={true}
        onBackPress={() => safeGoBack(navigation)}
      />

      <View style={styles.content}>
        <CollectionTabBar
          activeTab={activeTab}
          onTabPress={handleTabPress}
          pendingLabel={t('collection.pendingTab')}
          paidLabel={t('collection.paidTab')}
        />

        <View style={styles.filtersSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.text.tertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('common.search')}
                placeholderTextColor={COLORS.text.tertiary}
                value={searchText}
                onChangeText={setSearchText}
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
            <Pressable
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.datePickerText}>
                {formatDisplayDate(selectedDate) + ' -- ' + formatDisplayDateWithDay(selectedDate)}
              </Text>
            </Pressable>
          </View>

          {showDatePicker && (
            Platform.OS === 'ios' ? (
              <Modal
                transparent={true}
                animationType="slide"
                visible={showDatePicker}
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.modalButton}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>{t('collection.selectDate')}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setShowDatePicker(false);
                          refreshListsForFilters(searchText, selectedDate);
                        }}
                      >
                        <Text style={[styles.modalButton, styles.modalButtonDone]}>{t('common.ok')}</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                    />
                  </View>
                </View>
              </Modal>
            ) : (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )
          )}
        </View>

        <View style={styles.listContainer}>
          {showListOverlay ? (
            <View style={styles.tabSwitchOverlay} pointerEvents="box-none">
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.tabSwitchLoadingText}>{t('collection.loadingCollections')}</Text>
            </View>
          ) : null}

          <CollectionListPane
            isActive={deferredTab === 'pending'}
            data={pendingList}
            loading={loading}
            loadingMore={loadingMoreUnpaid}
            hasNextPage={unpaidPagination.hasNextPage}
            renderItem={renderCollectionItem}
            keyExtractor={(item, index) => `p-${item.id || index}`}
            ListEmptyComponent={renderPendingEmpty}
            ListFooterComponent={pendingList.length > 0 ? renderUnpaidFooter : null}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onEndReached={loadMoreUnpaid}
            onLayout={(e) => {
              pendingContainerHeightRef.current = e.nativeEvent.layout.height;
              maybeLoadMoreUnpaidIfShort();
            }}
            onContentSizeChange={(_, h) => {
              pendingContentHeightRef.current = h;
              maybeLoadMoreUnpaidIfShort();
            }}
            contentContainerStyle={[
              styles.flatListContent,
              (loading || pendingList.length === 0) && styles.flatListContentGrow,
            ]}
          />

          <CollectionListPane
            isActive={deferredTab === 'paid'}
            data={paidList}
            loading={loadingPaid}
            loadingMore={loadingMorePaid}
            hasNextPage={paidPagination.hasNextPage}
            renderItem={renderCollectionItem}
            keyExtractor={(item, index) => `d-${item.id || index}`}
            ListEmptyComponent={renderPaidEmpty}
            ListFooterComponent={paidList.length > 0 ? renderPaidFooter : null}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onEndReached={loadMorePaid}
            onLayout={(e) => {
              paidContainerHeightRef.current = e.nativeEvent.layout.height;
              maybeLoadMorePaidIfShort();
            }}
            onContentSizeChange={(_, h) => {
              paidContentHeightRef.current = h;
              maybeLoadMorePaidIfShort();
            }}
            contentContainerStyle={[
              styles.flatListContent,
              (loadingPaid || paidList.length === 0) && styles.flatListContentGrow,
            ]}
          />
        </View>

        <View style={styles.loanTypeFooter}>
          <Pressable
            style={[styles.loanTypeTab, loanTypeTab === 'weekly' && styles.loanTypeTabActive]}
            onPress={() => handleLoanTypeTabPress('weekly')}
            android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
          >
            <Text style={[styles.loanTypeTabText, loanTypeTab === 'weekly' && styles.loanTypeTabTextActive]}>
              {t('collection.weeklyTab')}
            </Text>
            <View style={[styles.loanTypeBadge, loanTypeTab === 'weekly' && styles.loanTypeBadgeActive]}>
              <Text style={[styles.loanTypeBadgeText, loanTypeTab === 'weekly' && styles.loanTypeBadgeTextActive]}>
                {weeklyLoanTypeCount}
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.loanTypeTab, loanTypeTab === 'daily' && styles.loanTypeTabActive]}
            onPress={() => handleLoanTypeTabPress('daily')}
            android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
          >
            <Text style={[styles.loanTypeTabText, loanTypeTab === 'daily' && styles.loanTypeTabTextActive]}>
              {t('collection.dailyTab')}
            </Text>
            <View style={[styles.loanTypeBadge, loanTypeTab === 'daily' && styles.loanTypeBadgeActive]}>
              <Text style={[styles.loanTypeBadgeText, loanTypeTab === 'daily' && styles.loanTypeBadgeTextActive]}>
                {dailyLoanTypeCount}
              </Text>
            </View>
          </Pressable>

        </View>
      </View>

      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.photoModalBackdrop}
          activeOpacity={1}
          onPress={() => setPhotoModalVisible(false)}
        >
          <View style={styles.photoModalContent}>
            <TouchableOpacity
              style={styles.photoModalClose}
              onPress={() => setPhotoModalVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={36} color={COLORS.white} />
            </TouchableOpacity>
            {photoModalUri ? (
              <Image
                source={{ uri: photoModalUri }}
                style={styles.photoModalImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={handleClosePaymentModal}
      >
        <View style={[styles.paymentDrawerOverlay, { paddingBottom: bottomInset }]}>
          <Pressable style={styles.paymentDrawerDismiss} onPress={handleClosePaymentModal} />
          <View style={styles.paymentDrawerSheet}>
            <View style={styles.centeredModalHeader}>
              <Text style={styles.paymentModalTitle}>{t('collection.submitPayment')}</Text>
              <TouchableOpacity onPress={handleClosePaymentModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedCollection && (
              <View style={styles.centeredModalBody}>
                <ScrollView
                  ref={paymentScrollRef}
                  style={styles.centeredModalScrollView}
                  contentContainerStyle={[
                    styles.centeredModalContent,
                    {
                      paddingBottom: SIZES.padding + (
                        paymentKeyboardHeight > 0
                          ? paymentKeyboardHeight
                          : 24
                      ),
                    },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="none"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerInfoName}>
                      {selectedCollection.customerNo} - {selectedCollection.customerName}
                    </Text>
                    <Text style={styles.customerInfoBalance}>
                      {t('collection.balanceAmount')}: {selectedCollection.getFormattedBalanceAmount()}
                    </Text>
                    {selectedCollection.extraAmount != null && selectedCollection.extraAmount !== '' && (
                      <Text style={styles.customerInfoExtraAmount}>
                        {t('collection.extraAmount')}: {formatCurrencyOrDash(selectedCollection.extraAmount)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.paymentModeContainer}>
                    <Text style={styles.fieldLabel}>{t('collection.paymentMode')}</Text>
                    <View style={styles.radioButtonContainer}>
                      <TouchableOpacity
                        style={styles.radioButton}
                        onPress={() => setPaymentMode('Cash')}
                      >
                        <View style={styles.radioButtonCircle}>
                          {paymentMode === 'Cash' && <View style={styles.radioButtonInner} />}
                        </View>
                        <Text style={styles.radioButtonLabel}>{t('common.cash')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.radioButton}
                        onPress={() => setPaymentMode('Online')}
                      >
                        <View style={styles.radioButtonCircle}>
                          {paymentMode === 'Online' && <View style={styles.radioButtonInner} />}
                        </View>
                        <Text style={styles.radioButtonLabel}>{t('common.online')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View
                    style={styles.inputFieldContainer}
                    onLayout={(event) => {
                      amountFieldYRef.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.fieldLabel}>{t('collection.collectedAmount')} *</Text>
                    <TextInput
                      ref={collectedAmountRef}
                      style={[
                        styles.inputField,
                        paymentErrors.collectedAmount && styles.inputFieldError,
                      ]}
                      placeholder={t('collection.enterAmount')}
                      placeholderTextColor={COLORS.text.tertiary}
                      value={collectedAmount}
                      keyboardType="numeric"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      submitBehavior="submit"
                      onFocus={() => {
                        ensurePaymentScrollRoom();
                        scrollPaymentToField(amountFieldYRef.current);
                      }}
                      onSubmitEditing={() => remarksRef.current?.focus()}
                      onChangeText={(text) => {
                        const digitsOnly = text.replace(/[^0-9]/g, '');
                        if (selectedCollection && digitsOnly) {
                          const balanceAmount = parseFloat(selectedCollection.balanceAmount) || 0;
                          const enteredAmount = parseFloat(digitsOnly);
                          const allowExceedWhenInitialPayment = shouldAllowPaymentWhenBalanceZero(selectedCollection);
                          if (!allowExceedWhenInitialPayment && !isNaN(enteredAmount) && enteredAmount > balanceAmount) {
                            setCollectedAmount(String(balanceAmount));
                            setPaymentErrors({
                              ...paymentErrors,
                              collectedAmount: `${t('collection.amountCannotExceed')} (${selectedCollection.getFormattedBalanceAmount()})`,
                            });
                            return;
                          }
                        }
                        setCollectedAmount(digitsOnly);
                        if (paymentErrors.collectedAmount) {
                          setPaymentErrors({ ...paymentErrors, collectedAmount: '' });
                        }
                      }}
                    />
                    {paymentErrors.collectedAmount && (
                      <Text style={styles.errorTextSmall}>{paymentErrors.collectedAmount}</Text>
                    )}
                  </View>

                  <View
                    style={styles.inputFieldContainer}
                    onLayout={(event) => {
                      remarksFieldYRef.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.fieldLabel}>{t('common.remarks')}</Text>
                    <TextInput
                      ref={remarksRef}
                      style={[styles.inputField, styles.textArea]}
                      placeholder={t('collection.enterRemarks')}
                      placeholderTextColor={COLORS.text.tertiary}
                      value={remarks}
                      onChangeText={setRemarks}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      returnKeyType="next"
                      blurOnSubmit
                      onFocus={() => {
                        ensurePaymentScrollRoom();
                        scrollPaymentToField(remarksFieldYRef.current);
                      }}
                      onSubmitEditing={() => {
                        remarksRef.current?.blur();
                        paymentScrollRef.current?.scrollToEnd?.({ animated: true });
                      }}
                    />
                  </View>
                  <View style={styles.submitButtonInScroll}>
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        isSubmitting && styles.submitButtonDisabled,
                      ]}
                      onPress={handleSubmitPayment}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.submitButtonText}>
                        {isSubmitting ? t('common.loading') : t('common.submit')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    paddingTop: SIZES.padding * 1.5,
  },
  headerTitle: {
    fontSize: SIZES.h2,
    fontWeight: '700',
    color: COLORS.white,
  },
  content: {
    flex: 1,
  },
  filtersSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.base,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    height: 44, // Consistent height for both components
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SIZES.base / 2,
    height: 44, // Consistent height for both components
  },
  datePickerText: {
    fontSize: SIZES.body3,
    color: COLORS.black,
  },
  searchIcon: {
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.black,
    height: 44, // Match container height
  },
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: COLORS.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding,
    gap: SIZES.base / 2,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: SIZES.body3,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  tabLabelActive: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  loanTypeFooter: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  loanTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.base,
    paddingVertical: 10,
  },
  loanTypeTabActive: {
    borderTopWidth: 2,
    borderTopColor: COLORS.white,
    backgroundColor: COLORS.primary,
    marginTop: -1,
  },
  loanTypeTabText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  loanTypeTabTextActive: {
    color: COLORS.white,
  },
  loanTypeBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightGray,
  },
  loanTypeBadgeActive: {
    backgroundColor: COLORS.white,
  },
  loanTypeBadgeText: {
    fontSize: SIZES.body5,
    fontWeight: '700',
    color: COLORS.text.secondary,
  },
  loanTypeBadgeTextActive: {
    color: COLORS.primary,
  },
  tabSwitchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.base,
  },
  tabSwitchLoadingText: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginTop: SIZES.base,
  },
  flatListContent: {
    paddingBottom: SIZES.padding,
  },
  flatListContentGrow: {
    flexGrow: 1,
  },
  hiddenTab: {
    opacity: 0,
    zIndex: -1,
  },
  footerLoader: {
    paddingVertical: SIZES.padding,
  },
  listItem: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2, // Reduced from 16px to 8px for more compact layout
    marginBottom: SIZES.base / 2, // Reduced from 8px to 4px for more compact layout
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listItemPending: {
    borderColor: '#F5D000',
    borderWidth: 2,
  },
  listItemHighPending: {
    borderColor: '#FED7AA',
    borderWidth: 2,
  },
  collectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  collectionCardHeaderBody: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  collectionCardPhotoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: SIZES.base,
    backgroundColor: COLORS.lightGray,
  },
  collectionCardPhoto: {
    width: '100%',
    height: '100%',
  },
  collectionCardNameLine: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: SIZES.base * 0.375,
    lineHeight: Math.round((SIZES.body1 || 16) * 1.25),
  },
  collectionCardNameLineInline: {
    marginBottom: 0,
    flex: 1,
    marginRight: SIZES.base * 0.75,
    minWidth: 0,
  },
  collectionCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collectionCardIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base / 2,
    alignSelf: 'flex-start',
  },
  collectionCardIconButton: {
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  photoModalImage: {
    width: '100%',
    height: '80%',
  },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.base / 2, // Reduced from 8px to 4px for more compact layout
    marginLeft: 0,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base / 2, // Reduced from 8px to 4px for more compact layout
    minHeight: 24,
  },
  itemRowLast: {
    marginBottom: 0,
  },
  itemAssets: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    flex: 1,
    marginRight: SIZES.base,
  },
  itemMetaLeft: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
  },
  itemMetaRight: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginLeft: SIZES.base,
  },
  extraAmountText: {
    color: COLORS.error || '#FF3B30',
    fontWeight: '600',
  },
  itemLocality: {
    fontSize: SIZES.body4,
    color: COLORS.text.tertiary,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius / 2,
    minWidth: 56,
    alignItems: 'center',
  },
  statusText: {
    fontSize: SIZES.body5,
    color: COLORS.white,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 3,
  },
  loadingText: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: SIZES.body2,
    color: COLORS.error || '#FF4444',
    textAlign: 'center',
    marginBottom: SIZES.margin,
  },
  errorTextSmall: {
    fontSize: SIZES.body4,
    color: COLORS.error || '#FF4444',
    marginTop: SIZES.base / 2,
  },
  emptyText: {
    fontSize: SIZES.body2,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    marginTop: SIZES.margin,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    paddingBottom: Platform.OS === 'ios' ? 40 : SIZES.padding,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.black,
  },
  modalButton: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
  },
  modalButtonDone: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Payment drawer (same keyboard behavior as Edai Varavu)
  paymentDrawerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  paymentDrawerDismiss: {
    flex: 1,
  },
  paymentDrawerSheet: {
    width: '100%',
    maxHeight: '100%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    overflow: 'hidden',
  },
  centeredModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  closeButton: {
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
  },
  paymentModalTitle: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.black,
  },
  centeredModalBody: {
    flexGrow: 0,
    flexShrink: 1,
  },
  centeredModalScrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  centeredModalContent: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
  },
  submitButtonInScroll: {
    marginTop: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  customerInfo: {
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  customerInfoName: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: SIZES.base / 2,
  },
  customerInfoBalance: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
  },
  customerInfoExtraAmount: {
    fontSize: SIZES.body3,
    color: COLORS.error || '#FF3B30',
    fontWeight: '600',
    marginTop: SIZES.base / 2,
  },
  paymentModeContainer: {
    marginBottom: SIZES.margin,
  },
  fieldLabel: {
    fontSize: SIZES.body3,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: SIZES.base,
  },
  radioButtonContainer: {
    flexDirection: 'row',
    gap: SIZES.padding * 2,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
  },
  radioButtonCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  radioButtonLabel: {
    fontSize: SIZES.body2,
    color: COLORS.black,
  },
  inputFieldContainer: {
    marginBottom: SIZES.margin,
  },
  inputField: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    fontSize: SIZES.body2,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  inputFieldError: {
    borderColor: COLORS.error || '#FF4444',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    height: 48,
    minHeight: 48,
    maxHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body1,
    fontWeight: '600',
  },
});

export default CollectionScreen;

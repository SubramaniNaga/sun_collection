import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, InteractionManager, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import PaginationListFooter from '../../components/common/PaginationListFooter';
import { COLORS, SIZES } from '../../constants/theme';
import { DEBOUNCE_MS_DEFAULT } from '../../hooks/useDebouncedValue';
import Collection from '../../models/Collection';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showAlert, showError, showSuccess, showWarning } from '../../utils/alertService';
import { formatCurrency } from '../../utils/amountFormatters';
import { formatDateForAPI, formatDisplayDate, getCurrentDateString } from '../../utils/dateFormatter';
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

const API_BASE_URL = 'http://65.0.100.65:6005';
const UNPAID_LIMIT = 10;
const PAID_LIMIT = 10;

const parseCollectionsFromResponse = (response) => {
  const raw = response?.data?.collections ?? response?.collections;
  return Array.isArray(raw) ? raw : [];
};
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/api')) return `${API_BASE_URL}${imagePath}`;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}/api/v1${cleanPath}`;
};

const areListPanePropsEqual = (prev, next) =>
  prev.isActive === next.isActive &&
  prev.data === next.data &&
  prev.loading === next.loading &&
  prev.loadingMore === next.loadingMore &&
  prev.hasNextPage === next.hasNextPage;

const CollectionTabBar = memo(function CollectionTabBar({
  activeTab,
  onTabPress,
  pendingLabel,
  paidLabel,
  pendingBadgeCount,
  paidBadgeCount,
  showPendingBadge,
  showPaidBadge,
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
        {showPendingBadge ? (
          <View style={[styles.tabBadge, activeTab === 'pending' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'pending' && styles.tabBadgeTextActive]}>
              {pendingBadgeCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        style={[styles.tabItem, activeTab === 'paid' && styles.tabItemActive]}
        onPress={() => onTabPress('paid')}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
      >
        <Text style={[styles.tabLabel, activeTab === 'paid' && styles.tabLabelActive]}>
          {paidLabel}
        </Text>
        {showPaidBadge ? (
          <View style={[styles.tabBadge, activeTab === 'paid' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'paid' && styles.tabBadgeTextActive]}>
              {paidBadgeCount}
            </Text>
          </View>
        ) : null}
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
  const [searchText, setSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingList, setPendingList] = useState([]);
  const [paidList, setPaidList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreUnpaid, setLoadingMoreUnpaid] = useState(false);
  const [loadingPaid, setLoadingPaid] = useState(true);
  const [loadingMorePaid, setLoadingMorePaid] = useState(false);
  const [error, setError] = useState(null);
  const [paidError, setPaidError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [tabSwitchLoading, setTabSwitchLoading] = useState(false);
  const deferredTab = useDeferredValue(activeTab);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
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

  const fetchUnpaidCollections = useCallback(async (page = 1, append = false, searchQuery = '', collectionDate = null) => {
    try {
      if (page === 1 && !append) {
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

  const fetchPaidCollections = useCallback(async (page = 1, append = false, searchQuery = '', collectionDate = null) => {
    try {
      if (page === 1 && !append) {
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

  const loadBothCollections = useCallback(
    (searchQuery = '', collectionDate = null) => {
      fetchUnpaidCollections(1, false, searchQuery, collectionDate);
      fetchPaidCollections(1, false, searchQuery, collectionDate);
    },
    [fetchUnpaidCollections, fetchPaidCollections]
  );

  const refreshListsForFilters = useCallback(
    (searchQuery = '', collectionDate = null) => {
      setLoading(true);
      setLoadingPaid(true);
      loadBothCollections(searchQuery, collectionDate);
    },
    [loadBothCollections]
  );

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

  // Initial load: fetch unpaid + paid in parallel when screen opens
  useFocusEffect(
    useCallback(() => {
      loadBothCollections(searchTextRef.current, selectedDate);
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
  const pendingBadgeCount = unpaidPagination.totalRecords || pendingList.length;
  const paidBadgeCount = paidPagination.totalRecords || paidList.length;
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
        showError(t('common.error'), t('collection.noBalanceToCollect'));
        return;
      }
    }

    if (collection.isPaid()) {
      showAlert({
        type: 'warning',
        title: 'Payment done',
        message: 'Want to pay again?',
        buttons: [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              if ((parseFloat(collection.balanceAmount) || 0) <= 0) {
                if (!shouldAllowPaymentWhenBalanceZero(collection)) {
                  showError(t('common.error'), t('collection.noBalanceToCollect'));
                  return;
                }
              }
              openPaymentModal(collection);
            },
          },
        ],
      });
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

      for (;;) {
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
    if (!validatePaymentForm()) {
      return;
    }

    if (!selectedCollection || !selectedCollection.id) {
      showError(t('common.error'), t('collection.noCollections'));
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
    setShowPaymentModal(false);
    setSelectedCollection(null);
    setPaymentMode('Cash');
    setCollectedAmount('');
    setRemarks('');
    setPaymentErrors({});
  };

  const handleTabPress = useCallback((tab) => {
    if (activeTabRef.current === tab) return;
    setActiveTab(tab);
    setTabSwitchLoading(true);
  }, []);

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
    const displayId = collection.customerId ?? collection.customerNo ?? '—';

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
          pendingBadgeCount={pendingBadgeCount}
          paidBadgeCount={paidBadgeCount}
          showPendingBadge={!loading}
          showPaidBadge={!loadingPaid}
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
              />
            </View>
            <Pressable
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.datePickerText}>
                {formatDisplayDate(selectedDate)}
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
        transparent={true}
        animationType="fade"
        onRequestClose={handleClosePaymentModal}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable
            style={styles.centeredModalBackdrop}
            onPress={handleClosePaymentModal}
          />
          <View style={styles.centeredModalContainer}>
            <View style={styles.centeredModalHeader}>
              <Text style={styles.paymentModalTitle}>{t('collection.submitPayment')}</Text>
              <TouchableOpacity onPress={handleClosePaymentModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedCollection && (
              <View style={styles.centeredModalBody}>
                <KeyboardAwareScrollView
                  style={styles.centeredModalScrollView}
                  contentContainerStyle={styles.centeredModalContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  enableOnAndroid={true}
                  enableAutomaticScroll={true}
                  extraScrollHeight={100}
                  keyboardOpeningTime={0}
                >
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerInfoName}>
                      {selectedCollection.customerNo} - {selectedCollection.customerName}
                    </Text>
                    <Text style={styles.customerInfoBalance}>
                      {t('collection.balanceAmount')}: {selectedCollection.getFormattedBalanceAmount()}
                    </Text>
                  </View>

                  {/* Payment Mode Radio Buttons */}
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

                  {/* Collected Amount Input */}
                  <View style={styles.inputFieldContainer}>
                    <Text style={styles.fieldLabel}>{t('collection.collectedAmount')} *</Text>
                    <TextInput
                      style={[
                        styles.inputField,
                        paymentErrors.collectedAmount && styles.inputFieldError,
                      ]}
                      placeholder={t('collection.enterAmount')}
                      placeholderTextColor={COLORS.text.tertiary}
                      value={collectedAmount}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        // Remove non-digits
                        const digitsOnly = text.replace(/[^0-9]/g, '');

                        // If there's a balance amount, restrict input
                        if (selectedCollection && digitsOnly) {
                          const balanceAmount = parseFloat(selectedCollection.balanceAmount) || 0;
                          const enteredAmount = parseFloat(digitsOnly);
                          const allowExceedWhenInitialPayment = shouldAllowPaymentWhenBalanceZero(selectedCollection);

                          // If entered amount exceeds balance, cap it at balance
                          if (!allowExceedWhenInitialPayment && !isNaN(enteredAmount) && enteredAmount > balanceAmount) {
                            // Set to balance amount
                            setCollectedAmount(String(balanceAmount));
                            // Show error message
                            setPaymentErrors({
                              ...paymentErrors,
                              collectedAmount: `${t('collection.amountCannotExceed')} (${selectedCollection.getFormattedBalanceAmount()})`,
                            });
                            return;
                          }
                        }

                        // Update amount
                        setCollectedAmount(digitsOnly);

                        // Clear error if amount is valid
                        if (paymentErrors.collectedAmount) {
                          setPaymentErrors({ ...paymentErrors, collectedAmount: '' });
                        }
                      }}
                    />
                    {paymentErrors.collectedAmount && (
                      <Text style={styles.errorTextSmall}>{paymentErrors.collectedAmount}</Text>
                    )}
                  </View>

                  {/* Remarks Input */}
                  <View style={styles.inputFieldContainer}>
                    <Text style={styles.fieldLabel}>{t('common.remarks')}</Text>
                    <TextInput
                      style={[styles.inputField, styles.textArea]}
                      placeholder={t('collection.enterRemarks')}
                      placeholderTextColor={COLORS.text.tertiary}
                      value={remarks}
                      onChangeText={setRemarks}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </KeyboardAwareScrollView>

                {/* Fixed Submit Button at Bottom */}
                <View style={styles.submitButtonFixed}>
                  <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={handleSubmitPayment}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.submitButtonText}>
                      {isSubmitting ? t('common.loading') : t('common.submit')}
                    </Text>
                  </TouchableOpacity>
                </View>
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
  tabBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.base / 2,
  },
  tabBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  tabBadgeText: {
    fontSize: SIZES.body5,
    fontWeight: '700',
    color: COLORS.text.secondary,
  },
  tabBadgeTextActive: {
    color: COLORS.white,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
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
  // Centered Modal Styles
  centeredModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  centeredModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centeredModalContainer: {
    width: '90%',
    maxWidth: 400,
    height: '75%',
    maxHeight: '75%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    flex: 1,
    flexDirection: 'column',
  },
  centeredModalScrollView: {
    flex: 1,
  },
  centeredModalContent: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
  },
  submitButtonFixed: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
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

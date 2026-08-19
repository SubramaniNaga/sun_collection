import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getImageUrl } from '../../api/apiClient';
import { apiServices } from '../../api/services/apiServices';
import FormPicker from '../../components/common/FormPicker';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import PaginationListFooter from '../../components/common/PaginationListFooter';
import VoiceMicButton from '../../components/common/VoiceMicButton';
import { COLORS, SIZES } from '../../constants/theme';
import { DEBOUNCE_MS_DEFAULT, useDebouncedValue } from '../../hooks/useDebouncedValue';
import Collection from '../../models/Collection';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showAlert, showError, showInfo, showSuccess } from '../../utils/alertService';
import { formatAmountPlain, formatCurrency } from '../../utils/amountFormatters';
import { guardAttendanceGatedEntry } from '../../utils/attendanceEntryGate';
import { getRegisterDayNameFromDate } from '../../utils/dateFormatter';
import { safeGoBack } from '../../utils/navigationHelpers';

const LIMIT = 10;
/** true = fill renewal fields from the Edai Varavu list row; false = empty fields for manual entry */
const prefill_data = false;
/** true = tapping a card with balance_amount 0 asks for loan renewal; false = show "no balance to collect" */
const renewal_on_zero_balance = true;


const REGISTER_DAY_VALUES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const formatCurrencyOrDash = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return '—';
  return formatCurrency(val);
};

const parseCollectionsFromResponse = (response) => {
  const data = response?.data ?? response;
  if (Array.isArray(data?.collections)) return data.collections;
  if (Array.isArray(data?.response)) return data.response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(response?.collections)) return response.collections;
  if (Array.isArray(response?.response)) return response.response;
  return [];
};

const getPaymentResponseData = (response) => {
  const payload = response?.data ?? response;
  return payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : payload;
};

/** Loan closed / eligible for renewal when payment success has loan_status 6. */
const getLoanStatusFromPaymentResponse = (response) => {
  const nested = getPaymentResponseData(response);
  const payload = response?.data ?? response;
  return (
    nested?.loan_status ??
    payload?.loan_status ??
    nested?.loan?.loan_status ??
    payload?.loan?.loan_status ??
    nested?.collection?.loan_status ??
    response?.loan_status ??
    null
  );
};

const getBalanceAmountFromPaymentResponse = (response) => {
  const nested = getPaymentResponseData(response);
  const payload = response?.data ?? response;
  return (
    nested?.balance_amount ??
    nested?.loan_balance_amount ??
    payload?.balance_amount ??
    payload?.loan_balance_amount ??
    nested?.loan?.balance_amount ??
    null
  );
};

const isLoanStatusEligibleForRenewal = (status) => Number(status) === 6;

const isBalanceEligibleForRenewal = (balance) => {
  if (balance === null || balance === undefined || balance === '') return false;
  const amount = Number(balance);
  return !Number.isNaN(amount) && amount === 0;
};

const shouldAskLoanRenewal = (response) => (
  isBalanceEligibleForRenewal(getBalanceAmountFromPaymentResponse(response))
  || isLoanStatusEligibleForRenewal(getLoanStatusFromPaymentResponse(response))
);

/** Same agent defaults as CustomerWithLoanScreen (AsyncStorage + loginResponse). */
const resolveAgentLoanDefaults = async (options = []) => {
  const empty = { loanTypeId: '', loanPeriod: '', disableType: false, disablePeriod: false };
  try {
    const storedLoanType = await AsyncStorage.getItem('loanType');
    const storedLoanPeriod = await AsyncStorage.getItem('loanPeriod');
    if (storedLoanType) {
      return {
        loanTypeId: storedLoanType,
        loanPeriod: storedLoanPeriod || '',
        disableType: true,
        disablePeriod: Boolean(storedLoanPeriod),
      };
    }

    const loginResponse = await AsyncStorage.getItem('loginResponse');
    if (!loginResponse) return empty;
    const loginData = JSON.parse(loginResponse);
    const loginLoanType = loginData?.data?.loan_type;
    const loginLoanPeriod = loginData?.data?.loan_period;
    if (!loginLoanType) return empty;

    const matchingLoanType = options.find(
      (option) => String(option.label).toLowerCase() === String(loginLoanType).toLowerCase(),
    );
    if (!matchingLoanType) return empty;

    await AsyncStorage.setItem('loanType', matchingLoanType.value);
    const isDaily = String(loginLoanType).toLowerCase() === 'daily';
    if (isDaily && loginLoanPeriod) {
      await AsyncStorage.setItem('loanPeriod', String(loginLoanPeriod));
    }
    return {
      loanTypeId: matchingLoanType.value,
      loanPeriod: loginLoanPeriod ? String(loginLoanPeriod) : '',
      disableType: true,
      disablePeriod: Boolean(loginLoanPeriod),
    };
  } catch {
    return empty;
  }
};

const ANDROID_NAV_BAR_HEIGHT = 56;
const KEYBOARD_FALLBACK_HEIGHT = 280;

const getBottomInset = (insets) => (
  Platform.OS === 'android'
    ? Math.max(insets.bottom, ANDROID_NAV_BAR_HEIGHT)
    : Math.max(insets.bottom, SIZES.base)
);

const IntermediateIncomeScreen = ({ navigation }) => {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomInset = getBottomInset(insets);
  const [searchQuery, setSearchQuery] = useState('');
  const [registerDayFilter, setRegisterDayFilter] = useState(() => getRegisterDayNameFromDate());
  const debouncedSearchQuery = useDebouncedValue(searchQuery, DEBOUNCE_MS_DEFAULT);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    hasNextPage: false,
    totalPages: 1,
  });
  const fetchRequestIdRef = useRef(0);
  const loadMoreLockRef = useRef(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [collectedAmount, setCollectedAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const collectedAmountRef = useRef(null);
  const remarksRef = useRef(null);
  const paymentScrollRef = useRef(null);
  const amountFieldYRef = useRef(0);
  const remarksFieldYRef = useRef(0);
  const loanAmountRef = useRef(null);
  const loanPeriodRef = useRef(null);
  const aathayamRef = useRef(null);
  const magimaiRef = useRef(null);
  const [loanTypePickerOpen, setLoanTypePickerOpen] = useState(false);
  const [renewalDayPickerOpen, setRenewalDayPickerOpen] = useState(false);
  const navOpenedRef = useRef(null);
  const [paymentErrors, setPaymentErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentKeyboardHeight, setPaymentKeyboardHeight] = useState(0);
  const lastKeyboardHeightRef = useRef(KEYBOARD_FALLBACK_HEIGHT);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoModalUri, setPhotoModalUri] = useState(null);

  const [showRenewalForm, setShowRenewalForm] = useState(false);
  const [renewalCollection, setRenewalCollection] = useState(null);
  const [loanTypeOptions, setLoanTypeOptions] = useState([]);
  const [loanTypeId, setLoanTypeId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPeriod, setLoanPeriod] = useState('');
  const [aathayamAmount, setAathayamAmount] = useState('');
  const [magimaiAmount, setMagimaiAmount] = useState('');
  const [renewalDay, setRenewalDay] = useState('');
  const [renewalErrors, setRenewalErrors] = useState({});
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [isLoanTypeDisabled, setIsLoanTypeDisabled] = useState(false);
  const [isLoanPeriodDisabled, setIsLoanPeriodDisabled] = useState(false);

  const registerDayOptions = useMemo(
    () => REGISTER_DAY_VALUES.map((value) => ({
      label: t(`customer.${value.toLowerCase()}`),
      value,
    })),
    [t],
  );

  const selectedLoanTypeLabel = loanTypeOptions.find((o) => o.value === loanTypeId)?.label ?? '';
  const periodUnit = (() => {
    const lower = String(selectedLoanTypeLabel).toLowerCase();
    if (lower === 'daily') return t('loan.days') || 'days';
    if (lower === 'weekly') return t('loan.weeks') || 'weeks';
    if (lower === 'monthly') return t('loan.months') || 'months';
    return t('loan.months') || 'months';
  })();
  const isWeeklyLoanType = String(selectedLoanTypeLabel).toLowerCase() === 'weekly';
  const isSearchPending =
    String(searchQuery).trim() !== String(debouncedSearchQuery || '').trim();
  const showSearchLoader = searchQuery.length > 0 && (isSearchPending || loading);
  const showListLoader = loading || showSearchLoader;

  const buildSearchParams = useCallback((query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return {};
    return { customer_name: trimmed };
  }, []);

  const fetchList = useCallback(async (page = 1, append = false, skipPageLoader = false) => {
    const isPageOne = page === 1 && !append;
    const requestId = isPageOne ? ++fetchRequestIdRef.current : fetchRequestIdRef.current;
    try {
      if (isPageOne && !skipPageLoader) {
        setLoading(true);
        loadMoreLockRef.current = false;
      }

      const response = await apiServices.collection.getRegisteredDayCollections({
        page,
        limit: LIMIT,
        registered_day: registerDayFilter,
        ...buildSearchParams(debouncedSearchQuery),
      });

      if (requestId !== fetchRequestIdRef.current) return;

      const raw = parseCollectionsFromResponse(response);
      const models = Collection.fromApiResponseArray(raw);
      const pag = response?.pagination || response?.data?.pagination || {};

      setList((prev) => (append ? [...prev, ...models] : models));
      setPagination({
        currentPage: pag.currentPage ?? page,
        hasNextPage: Boolean(pag.hasNextPage),
        totalPages: pag.totalPages ?? 1,
      });
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      if (isPageOne) {
        showError(t('common.error'), getApiErrorMessage(err, t('collection.failedToLoad')));
        setList([]);
      }
    } finally {
      if (requestId !== fetchRequestIdRef.current) return;
      if (isPageOne) setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      loadMoreLockRef.current = false;
    }
  }, [registerDayFilter, debouncedSearchQuery, buildSearchParams, t]);

  useEffect(() => {
    fetchRequestIdRef.current += 1;
    setList([]);
    setLoading(true);
    setLoadingMore(false);
    loadMoreLockRef.current = false;
    setPagination({ currentPage: 1, hasNextPage: false, totalPages: 1 });
  }, [registerDayFilter, debouncedSearchQuery]);

  useEffect(() => {
    fetchList(1, false);
  }, [fetchList]);

  useEffect(() => {
    let cancelled = false;
    apiServices.loan.getLoanTypes()
      .then((types) => {
        if (cancelled || !Array.isArray(types)) return;
        setLoanTypeOptions(types.map((item) => ({
          label: item.loan_type ?? String(item.id),
          value: String(item.id),
        })));
      })
      .catch(() => {
        if (!cancelled) setLoanTypeOptions([]);
      });
    return () => { cancelled = true; };
  }, []);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !pagination.hasNextPage || loadMoreLockRef.current) return;
    loadMoreLockRef.current = true;
    setLoadingMore(true);
    fetchList(pagination.currentPage + 1, true);
  }, [loading, loadingMore, pagination, fetchList]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchList(1, false, true);
  }, [fetchList]);

  const handlePhonePress = (phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      showError(t('common.error'), t('collection.call'));
    });
  };

  const handleMapPress = (address) => {
    if (!address || !String(address).trim()) {
      showError(t('common.error'), t('collection.map'));
      return;
    }
    const encodedAddress = encodeURIComponent(String(address).trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`).catch(() => {
      showError(t('common.error'), t('collection.map'));
    });
  };

  const renderActionIcons = (collection) => (
    <View style={styles.collectionCardIconsRow}>
      <TouchableOpacity
        style={styles.collectionCardIconButton}
        onPress={() => handleMapPress(collection.customerAddress)}
      >
        <Ionicons name="map-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.collectionCardIconButton}
        onPress={() => handlePhonePress(collection.customerPhone)}
      >
        <Ionicons name="call" size={18} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );

  const shouldAllowPaymentWhenBalanceZero = (collection) => {
    const balanceAmount = parseFloat(collection?.balanceAmount) || 0;
    const completedCount = parseInt(collection?.completedCount, 10) || 0;
    if (balanceAmount !== 0) return true;
    return completedCount === 0;
  };

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
    const balanceAmount = parseFloat(collection.balanceAmount) || 0;
    if (balanceAmount === 0) {
      if (renewal_on_zero_balance) {
        askLoanRenewal(collection, { afterPayment: false });
        return;
      }
      showInfo('', t('collection.noBalanceToCollect'));
      return;
    }
    if (balanceAmount < 0 && !shouldAllowPaymentWhenBalanceZero(collection)) {
      showInfo('', t('collection.noBalanceToCollect'));
      return;
    }
    openPaymentModal(collection);
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

  const validatePaymentForm = () => {
    const errors = {};
    if (!collectedAmount || collectedAmount.trim() === '') {
      errors.collectedAmount = t('collection.collectedAmountRequired');
    } else {
      const amount = parseFloat(collectedAmount);
      if (isNaN(amount) || amount <= 0) {
        errors.collectedAmount = t('collection.collectedAmountInvalid');
      } else if (selectedCollection) {
        const balanceAmount = parseFloat(selectedCollection.balanceAmount) || 0;
        const completedCount = parseInt(selectedCollection.completedCount, 10) || 0;
        const isInitialZeroBalance = balanceAmount === 0 && completedCount === 0;
        if (!isInitialZeroBalance && amount > balanceAmount) {
          errors.collectedAmount = `${t('collection.collectedAmountExceed')} (${selectedCollection.getFormattedBalanceAmount()})`;
        }
      }
    }
    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getCurrentLocation = async () => {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      throw new Error('Location services are disabled');
    }
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  };

  const openRenewalForm = async (collection) => {
    setRenewalCollection(collection);
    setRenewalErrors({});
    const agent = await resolveAgentLoanDefaults(loanTypeOptions);
    setLoanTypeId(agent.loanTypeId);
    setLoanPeriod(agent.loanPeriod);
    setIsLoanTypeDisabled(agent.disableType);
    setIsLoanPeriodDisabled(agent.disablePeriod);

    if (prefill_data) {
      if (!agent.loanTypeId) {
        const typeId = collection?.loanTypeId != null ? String(collection.loanTypeId) : '';
        const matchedByName = loanTypeOptions.find(
          (opt) => String(opt.label).toLowerCase() === String(collection?.loanTypeName || '').toLowerCase(),
        );
        setLoanTypeId(typeId || matchedByName?.value || '');
      }
      if (!agent.loanPeriod) {
        setLoanPeriod(collection?.loanPeriod != null ? String(collection.loanPeriod) : '');
      }
      setLoanAmount(collection?.loanAmount != null ? formatAmountPlain(collection.loanAmount) : '');
      setAathayamAmount(collection?.processingFees != null ? formatAmountPlain(collection.processingFees) : '');
      setMagimaiAmount(collection?.intrestAmount != null ? formatAmountPlain(collection.intrestAmount) : '');
      setRenewalDay(registerDayFilter || collection?.registerDay || '');
    } else {
      setLoanAmount('');
      setAathayamAmount('');
      setMagimaiAmount('');
      setRenewalDay('');
    }
    setShowRenewalForm(true);
  };

  const askLoanRenewal = (collection, { afterPayment = false } = {}) => {
    showAlert({
      type: 'info',
      title: t('intermediateIncome.loanRenewalNeeded'),
      message: t('intermediateIncome.loanRenewalMessage'),
      buttons: [
        {
          text: t('common.no'),
          style: 'cancel',
          onPress: () => {
            if (afterPayment) {
              showSuccess(t('common.success'), t('success.collectionUpdated'));
              fetchList(1, false, true);
            }
          },
        },
        {
          text: t('common.yes'),
          onPress: () => openRenewalForm(collection),
        },
      ],
    });
  };

  const handleSubmitPayment = async () => {
    if (!guardAttendanceGatedEntry(t)) return;
    if (!validatePaymentForm()) return;
    if (!selectedCollection?.id) {
      showError(t('common.error'), t('collection.noCollections'));
      return;
    }

    setIsSubmitting(true);
    const collectionForRenewal = selectedCollection;
    try {
      let latitude = null;
      let longitude = null;
      try {
        const location = await getCurrentLocation();
        latitude = location.latitude;
        longitude = location.longitude;
      } catch {
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
      }

      const payload = {
        amount_paid: parseFloat(collectedAmount),
        payment_type: paymentMode,
      };
      if (latitude != null && longitude != null) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }
      if (remarks.trim()) {
        payload.notes = remarks.trim();
      }

      const paymentRes = await apiServices.collection.updateAmount(selectedCollection.id, payload);
      console.log('📋 IntermediateIncome: updateAmount FULL response:');
      console.log(JSON.stringify(paymentRes, null, 2));
      handleClosePaymentModal();

      const balanceAmount = getBalanceAmountFromPaymentResponse(paymentRes);
      const loanStatus = getLoanStatusFromPaymentResponse(paymentRes);
      console.log('📋 IntermediateIncome: renewal check:', { balanceAmount, loanStatus });
      if (shouldAskLoanRenewal(paymentRes)) {
        setTimeout(() => askLoanRenewal(collectionForRenewal, { afterPayment: true }), 350);
      } else {
        showSuccess(t('common.success'), t('success.collectionUpdated'));
        fetchList(1, false, true);
      }
    } catch (err) {
      showError(t('common.error'), getApiErrorMessage(err, t('errors.somethingWentWrong')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeRenewalForm = () => {
    setShowRenewalForm(false);
    setRenewalCollection(null);
    setRenewalErrors({});
    setIsLoanTypeDisabled(false);
    setIsLoanPeriodDisabled(false);
    fetchList(1, false, true);
  };

  const validateRenewalForm = () => {
    const errors = {};
    if (!loanTypeId) errors.loanTypeId = t('customer.selectLoanType');
    if (!String(loanAmount).trim() || Number(loanAmount) <= 0) {
      errors.loanAmount = t('customer.enterLoanAmount');
    }
    if (!String(loanPeriod).trim() || Number(loanPeriod) <= 0) {
      errors.loanPeriod = t('customer.loanPeriodRequired');
    }
    if (String(aathayamAmount).trim() === '') errors.aathayamAmount = t('customer.aathayamRequired');
    if (String(magimaiAmount).trim() === '') errors.magimaiAmount = t('customer.magimaiRequired');
    if (isWeeklyLoanType && !renewalDay) errors.renewalDay = t('customer.registerDay');
    setRenewalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitRenewal = async () => {
    if (!guardAttendanceGatedEntry(t)) return;
    if (!validateRenewalForm()) return;
    const customerId = renewalCollection?.customerId;
    if (!customerId) {
      showError(t('common.error'), t('customer.noCustomerFound'));
      return;
    }

    setRenewalSubmitting(true);
    try {
      const payload = {
        customer_id: Number(customerId),
        loan_amount: Number(loanAmount),
        loan_period: Number(loanPeriod),
        loantype_id: Number(loanTypeId),
        processing_fees: Number(aathayamAmount) || 0,
        intrest_amount: Number(magimaiAmount) || 0,
        registered_day: String(renewalDay || registerDayFilter),
      };
      console.log('💰 IntermediateIncome: renewLoan payload:', JSON.stringify(payload, null, 2));
      await apiServices.loan.renewLoan(payload);
      showSuccess(t('common.success'), t('loan.renewalSubmitted'), [
        { text: t('common.ok'), onPress: closeRenewalForm },
      ]);
    } catch (err) {
      showError(t('common.error'), getApiErrorMessage(err, t('loan.failedToProcessRenewal')));
    } finally {
      setRenewalSubmitting(false);
    }
  };

  const renderItem = ({ item }) => {
    const collection = item instanceof Collection ? item : new Collection(item);
    const displayId = collection.customerNo ?? collection.customerId ?? '—';
    return (
      <TouchableOpacity
        style={[styles.listItem, collection.isPending && styles.listItemPending]}
        onPress={() => handleItemPress(collection)}
        activeOpacity={0.7}
      >
        <View style={styles.collectionCardHeader}>
          <TouchableOpacity
            style={styles.collectionCardPhotoWrap}
            onPress={() => {
              const uri = getImageUrl(collection.customerPhoto);
              if (uri) {
                setPhotoModalUri(uri);
                setPhotoModalVisible(true);
              }
            }}
            activeOpacity={0.8}
          >
            {collection.customerPhoto ? (
              <Image source={{ uri: getImageUrl(collection.customerPhoto) }} style={styles.collectionCardPhoto} />
            ) : (
              <View style={[styles.collectionCardPhoto, styles.photoPlaceholder]}>
                <Ionicons name="person" size={18} color={COLORS.text.tertiary} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.collectionCardHeaderBody}>
            <View style={styles.collectionCardNameRow}>
              <Text
                style={[styles.collectionCardNameLine, styles.collectionCardNameLineInline]}
                numberOfLines={2}
              >
                {displayId} - {collection.customerName || '—'}
              </Text>
              {renderActionIcons(collection)}
            </View>
          </View>
        </View>

        <View style={styles.itemDivider} />
        <View style={styles.itemRow}>
          <Text style={styles.itemMetaLeft}>{t('loan.paid')}: {collection.getFormattedAmountPaid()}</Text>
          <Text style={styles.itemMetaRight}>{t('loan.balance')}: {collection.getFormattedBalanceAmount()}</Text>
        </View>
        <View style={[styles.itemRow, styles.itemRowLast]}>
          <Text style={styles.itemMetaLeft}>{t('customer.loanAmount')}: {formatCurrencyOrDash(collection.loanAmount)}</Text>
          <Text style={styles.itemMetaRight}>{collection.loanTypeName || ''}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (showRenewalForm) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <StatusBar style="light" backgroundColor={COLORS.statusBar} />
        <Header
          title={t('intermediateIncome.renewalTitle')}
          showBackButton
          onBackPress={closeRenewalForm}
        />
        <KeyboardAwareScrollView
          style={styles.renewalScroll}
          contentContainerStyle={styles.renewalContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
        >
          {renewalCollection ? (
            <Text style={styles.renewalCustomer}>
              {renewalCollection.customerNo} - {renewalCollection.customerName}
            </Text>
          ) : null}
          <FormPicker
            label={t('customer.loanType')}
            value={loanTypeId}
            onValueChange={(value) => {
              setLoanTypeId(value);
              if (navOpenedRef.current === 'loanType') {
                navOpenedRef.current = null;
                setTimeout(() => loanAmountRef.current?.focus(), 300);
              }
            }}
            items={loanTypeOptions}
            placeholder={t('customer.selectLoanType')}
            error={renewalErrors.loanTypeId}
            editable={!isLoanTypeDisabled}
            required
            visible={loanTypePickerOpen}
            onVisibleChange={(open) => {
              setLoanTypePickerOpen(open);
              if (!open && navOpenedRef.current === 'loanType' && !loanTypeId) {
                navOpenedRef.current = null;
              }
            }}
          />
          <Input
            ref={loanAmountRef}
            label={t('customer.loanAmount')}
            value={loanAmount}
            onChangeText={setLoanAmount}
            placeholder={t('customer.enterLoanAmount')}
            keyboardType="numeric"
            error={renewalErrors.loanAmount}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => loanPeriodRef.current?.focus()}
          />
          <Input
            ref={loanPeriodRef}
            label={`${t('customer.loanPeriod')} (${periodUnit})`}
            value={loanPeriod}
            onChangeText={setLoanPeriod}
            placeholder={t('customer.enterLoanPeriod')}
            keyboardType="numeric"
            error={renewalErrors.loanPeriod}
            disabled={isLoanPeriodDisabled}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => aathayamRef.current?.focus()}
          />
          <Input
            ref={aathayamRef}
            label={t('customer.aathayam')}
            value={aathayamAmount}
            onChangeText={setAathayamAmount}
            placeholder={language === 'en' ? 'Enter amount' : t('collection.enterAmount')}
            keyboardType="decimal-pad"
            error={renewalErrors.aathayamAmount}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => magimaiRef.current?.focus()}
          />
          <Input
            ref={magimaiRef}
            label={t('customer.magimai')}
            value={magimaiAmount}
            onChangeText={setMagimaiAmount}
            placeholder={language === 'en' ? 'Enter amount' : t('collection.enterAmount')}
            keyboardType="decimal-pad"
            error={renewalErrors.magimaiAmount}
            required
            returnKeyType={isWeeklyLoanType ? 'next' : 'done'}
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => {
              if (isWeeklyLoanType) {
                if (renewalDay) {
                  Keyboard.dismiss();
                  return;
                }
                Keyboard.dismiss();
                navOpenedRef.current = 'renewalDay';
                setRenewalDayPickerOpen(true);
                return;
              }
              Keyboard.dismiss();
            }}
          />
          {isWeeklyLoanType ? (
            <FormPicker
              label={t('customer.registerDay')}
              value={renewalDay}
              onValueChange={(value) => {
                setRenewalDay(value);
                navOpenedRef.current = null;
              }}
              items={registerDayOptions}
              placeholder={t('customer.registerDay')}
              error={renewalErrors.renewalDay}
              fitSheetToContent
              required
              visible={renewalDayPickerOpen}
              onVisibleChange={(open) => {
                setRenewalDayPickerOpen(open);
                if (!open && navOpenedRef.current === 'renewalDay' && !renewalDay) {
                  navOpenedRef.current = null;
                }
              }}
            />
          ) : null}
        </KeyboardAwareScrollView>
        <View style={styles.renewalFooter}>
          <TouchableOpacity
            style={[styles.submitButton, renewalSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmitRenewal}
            disabled={renewalSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {renewalSubmitting ? t('common.loading') : t('loan.processRenewal')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header
        title={t('intermediateIncome.title')}
        showBackButton
        onBackPress={() => safeGoBack(navigation)}
      />

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color={COLORS.primary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('intermediateIncome.searchPlaceholder')}
              placeholderTextColor={COLORS.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <VoiceMicButton value={searchQuery} onChangeText={setSearchQuery} />
            {showSearchLoader ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.searchLoader} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity style={styles.clearButton} onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.text.secondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.dayFilterWrapper}>
            <FormPicker
              value={registerDayFilter}
              onValueChange={setRegisterDayFilter}
              items={registerDayOptions}
              placeholder={t('customer.registerDay')}
              modalTitle={t('customer.registerDay')}
              compact
              compactUseFullLabel
              fitSheetToContent
              style={styles.dayFilterPicker}
            />
          </View>
        </View>
      </View>

      {showListLoader ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('collection.loadingCollections')}</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item, index) => String(item.id ?? index)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            list.length === 0 && styles.listContentGrow,
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>{t('collection.noCollections')}</Text>
            </View>
          }
          ListFooterComponent={
            list.length > 0 ? (
              <PaginationListFooter loadingMore={loadingMore} hasNextPage={pagination.hasNextPage} />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}

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
            >
              <Ionicons name="close-circle" size={36} color={COLORS.white} />
            </TouchableOpacity>
            {photoModalUri ? (
              <Image source={{ uri: photoModalUri }} style={styles.photoModalImage} resizeMode="contain" />
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
            {selectedCollection ? (
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
                  </View>
                  <View style={styles.paymentModeContainer}>
                    <Text style={styles.fieldLabel}>{t('collection.paymentMode')}</Text>
                    <View style={styles.radioButtonContainer}>
                      <TouchableOpacity style={styles.radioButton} onPress={() => setPaymentMode('Cash')}>
                        <View style={styles.radioButtonCircle}>
                          {paymentMode === 'Cash' ? <View style={styles.radioButtonInner} /> : null}
                        </View>
                        <Text style={styles.radioButtonLabel}>{t('common.cash')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.radioButton} onPress={() => setPaymentMode('Online')}>
                        <View style={styles.radioButtonCircle}>
                          {paymentMode === 'Online' ? <View style={styles.radioButtonInner} /> : null}
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
                    <View style={styles.voiceFieldRow}>
                    <TextInput
                      ref={collectedAmountRef}
                      style={[styles.inputField, styles.voiceFieldInput, paymentErrors.collectedAmount && styles.inputFieldError]}
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
                          const completedCount = parseInt(selectedCollection.completedCount, 10) || 0;
                          const isInitialZeroBalance = balanceAmount === 0 && completedCount === 0;
                          if (!isInitialZeroBalance && !Number.isNaN(enteredAmount) && enteredAmount > balanceAmount) {
                            setCollectedAmount(String(Math.trunc(balanceAmount)));
                            setPaymentErrors((prev) => ({
                              ...prev,
                              collectedAmount: `${t('collection.amountCannotExceed')} (${selectedCollection.getFormattedBalanceAmount()})`,
                            }));
                            return;
                          }
                        }
                        setCollectedAmount(digitsOnly);
                        if (paymentErrors.collectedAmount) {
                          setPaymentErrors((prev) => ({ ...prev, collectedAmount: '' }));
                        }
                      }}
                    />
                    <VoiceMicButton
                      value={collectedAmount}
                      onChangeText={(text) => {
                        const digitsOnly = String(text).replace(/[^0-9]/g, '');
                        if (selectedCollection && digitsOnly) {
                          const balanceAmount = parseFloat(selectedCollection.balanceAmount) || 0;
                          const enteredAmount = parseFloat(digitsOnly);
                          const completedCount = parseInt(selectedCollection.completedCount, 10) || 0;
                          const isInitialZeroBalance = balanceAmount === 0 && completedCount === 0;
                          if (!isInitialZeroBalance && !Number.isNaN(enteredAmount) && enteredAmount > balanceAmount) {
                            setCollectedAmount(String(Math.trunc(balanceAmount)));
                            setPaymentErrors((prev) => ({
                              ...prev,
                              collectedAmount: `${t('collection.amountCannotExceed')} (${selectedCollection.getFormattedBalanceAmount()})`,
                            }));
                            return;
                          }
                        }
                        setCollectedAmount(digitsOnly);
                        if (paymentErrors.collectedAmount) {
                          setPaymentErrors((prev) => ({ ...prev, collectedAmount: '' }));
                        }
                      }}
                    />
                    </View>
                    {paymentErrors.collectedAmount ? (
                      <Text style={styles.errorTextSmall}>{paymentErrors.collectedAmount}</Text>
                    ) : null}
                  </View>
                  <View
                    style={styles.inputFieldContainer}
                    onLayout={(event) => {
                      remarksFieldYRef.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.fieldLabel}>{t('common.remarks')}</Text>
                    <View style={styles.voiceFieldRow}>
                    <TextInput
                      ref={remarksRef}
                      style={[styles.inputField, styles.textArea, styles.voiceFieldInput]}
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
                    <VoiceMicButton value={remarks} onChangeText={setRemarks} />
                    </View>
                  </View>
                  <View style={styles.submitButtonInScroll}>
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
                </ScrollView>
              </View>
            ) : null}
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
  searchSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: SIZES.radius,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
  },
  dayFilterWrapper: {
    width: 126,
    flexShrink: 0,
    justifyContent: 'center',
    zIndex: 2,
    elevation: 2,
  },
  dayFilterPicker: {
    marginBottom: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.body4,
    color: COLORS.black,
    height: 44,
    paddingVertical: 0,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchLoader: {
    marginLeft: 4,
  },
  clearButton: {
    paddingHorizontal: 4,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  listContentGrow: {
    flexGrow: 1,
  },
  listItem: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  listItemPending: {
    borderColor: '#F5D000',
    borderWidth: 2,
  },
  collectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  collectionCardHeaderBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  collectionCardPhotoWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: COLORS.lightGray,
  },
  collectionCardPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionCardNameLine: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.black,
    lineHeight: Math.round((SIZES.body2 || 16) * 1.25),
  },
  collectionCardNameLineInline: {
    flex: 1,
    minWidth: 0,
    marginRight: SIZES.base / 2,
  },
  collectionCardNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  collectionCardIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: SIZES.base / 2,
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
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemRowLast: {
    marginBottom: 0,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 3,
  },
  loadingText: {
    marginTop: SIZES.base,
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
  },
  emptyText: {
    fontSize: SIZES.body2,
    color: COLORS.text.tertiary,
    textAlign: 'center',
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
    marginTop: SIZES.padding,
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
  voiceFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceFieldInput: {
    flex: 1,
  },
  inputFieldError: {
    borderColor: COLORS.error || '#FF4444',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorTextSmall: {
    fontSize: SIZES.body4,
    color: COLORS.error || '#FF4444',
    marginTop: SIZES.base / 2,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    minHeight: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  renewalScroll: {
    flex: 1,
  },
  renewalContent: {
    padding: SIZES.padding,
  },
  renewalCustomer: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: SIZES.padding,
  },
  renewalFooter: {
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
});

export default IntermediateIncomeScreen;

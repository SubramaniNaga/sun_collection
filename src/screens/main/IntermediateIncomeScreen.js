import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getImageUrl } from '../../api/apiClient';
import { apiServices } from '../../api/services/apiServices';
import FormPicker from '../../components/common/FormPicker';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import PaginationListFooter from '../../components/common/PaginationListFooter';
import { COLORS, SIZES } from '../../constants/theme';
import { DEBOUNCE_MS_DEFAULT, useDebouncedValue } from '../../hooks/useDebouncedValue';
import Collection from '../../models/Collection';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showAlert, showError, showInfo, showSuccess } from '../../utils/alertService';
import { formatCurrency } from '../../utils/amountFormatters';
import { guardAttendanceGatedEntry } from '../../utils/attendanceEntryGate';
import { getRegisterDayNameFromDate } from '../../utils/dateFormatter';
import { safeGoBack } from '../../utils/navigationHelpers';

const LIMIT = 10;
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
  if (Array.isArray(data)) return data;
  if (Array.isArray(response?.collections)) return response.collections;
  return [];
};

/** Loan closed / eligible for renewal when payment success has loan_status 6. */
const getLoanStatusFromPaymentResponse = (response) => {
  const payload = response?.data ?? response;
  return (
    payload?.loan_status ??
    payload?.loan?.loan_status ??
    payload?.collection?.loan_status ??
    response?.loan_status ??
    null
  );
};

const isLoanStatusEligibleForRenewal = (status) => Number(status) === 6;

const IntermediateIncomeScreen = ({ navigation }) => {
  const { t, language } = useLanguage();
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
  const [paymentErrors, setPaymentErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const registerDayOptions = useMemo(
    () => REGISTER_DAY_VALUES.map((value) => ({
      label: t(`customer.${value.toLowerCase()}`),
      value,
    })),
    [t],
  );

  const selectedLoanTypeLabel = loanTypeOptions.find((o) => o.value === loanTypeId)?.label ?? '';
  const isWeeklyLoanType = String(selectedLoanTypeLabel).toLowerCase() === 'weekly';

  const buildSearchParams = useCallback((query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return {};
    return { search: trimmed };
  }, []);

  const fetchList = useCallback(async (page = 1, append = false, skipPageLoader = false) => {
    const isPageOne = page === 1 && !append;
    const requestId = isPageOne ? ++fetchRequestIdRef.current : fetchRequestIdRef.current;
    try {
      if (isPageOne && !skipPageLoader) {
        setLoading(true);
        loadMoreLockRef.current = false;
      }

      const response = await apiServices.collection.getCollectionList({
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
    if (balanceAmount <= 0 && !shouldAllowPaymentWhenBalanceZero(collection)) {
      showInfo('', t('collection.noBalanceToCollect'));
      return;
    }
    openPaymentModal(collection);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedCollection(null);
    setPaymentMode('Cash');
    setCollectedAmount('');
    setRemarks('');
    setPaymentErrors({});
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
        const allowExceed = shouldAllowPaymentWhenBalanceZero(selectedCollection);
        if (!allowExceed && amount > balanceAmount) {
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

  const openRenewalForm = (collection) => {
    const typeId = collection?.loanTypeId != null ? String(collection.loanTypeId) : '';
    const matchedByName = loanTypeOptions.find(
      (opt) => String(opt.label).toLowerCase() === String(collection?.loanTypeName || '').toLowerCase(),
    );
    setRenewalCollection(collection);
    setLoanTypeId(typeId || matchedByName?.value || '');
    setLoanAmount(collection?.loanAmount != null ? String(collection.loanAmount) : '');
    setLoanPeriod(collection?.loanPeriod != null ? String(collection.loanPeriod) : '');
    setAathayamAmount(collection?.processingFees != null ? String(collection.processingFees) : '');
    setMagimaiAmount(collection?.intrestAmount != null ? String(collection.intrestAmount) : '');
    setRenewalDay(collection?.registerDay || registerDayFilter);
    setRenewalErrors({});
    setShowRenewalForm(true);
  };

  const askLoanRenewal = (collection) => {
    showAlert({
      type: 'info',
      title: t('intermediateIncome.loanRenewalNeeded'),
      message: t('intermediateIncome.loanRenewalMessage'),
      buttons: [
        {
          text: t('common.no'),
          style: 'cancel',
          onPress: () => {
            showSuccess(t('common.success'), t('success.collectionUpdated'));
            fetchList(1, false, true);
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

      const loanStatus = getLoanStatusFromPaymentResponse(paymentRes);
      if (isLoanStatusEligibleForRenewal(loanStatus)) {
        askLoanRenewal(collectionForRenewal);
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
            <Text style={styles.collectionCardNameLine} numberOfLines={1}>
              {displayId} - {collection.customerName || '—'}
            </Text>
            {/* <Text style={styles.itemMetaLeft} numberOfLines={1}>
              {collection.customerPhone || ''}
            </Text> */}
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
            onValueChange={setLoanTypeId}
            items={loanTypeOptions}
            placeholder={t('customer.selectLoanType')}
            error={renewalErrors.loanTypeId}
            required
          />
          <Input
            label={t('customer.loanAmount')}
            value={loanAmount}
            onChangeText={setLoanAmount}
            placeholder={t('customer.enterLoanAmount')}
            keyboardType="numeric"
            error={renewalErrors.loanAmount}
            required
          />
          <Input
            label={t('customer.loanPeriod')}
            value={loanPeriod}
            onChangeText={setLoanPeriod}
            placeholder={t('customer.enterLoanPeriod')}
            keyboardType="numeric"
            error={renewalErrors.loanPeriod}
            required
          />
          <Input
            label={t('customer.aathayam')}
            value={aathayamAmount}
            onChangeText={setAathayamAmount}
            placeholder={language === 'en' ? 'Enter amount' : t('collection.enterAmount')}
            keyboardType="decimal-pad"
            error={renewalErrors.aathayamAmount}
            required
          />
          <Input
            label={t('customer.magimai')}
            value={magimaiAmount}
            onChangeText={setMagimaiAmount}
            placeholder={language === 'en' ? 'Enter amount' : t('collection.enterAmount')}
            keyboardType="decimal-pad"
            error={renewalErrors.magimaiAmount}
            required
          />
          {isWeeklyLoanType ? (
            <FormPicker
              label={t('customer.registerDay')}
              value={renewalDay}
              onValueChange={setRenewalDay}
              items={registerDayOptions}
              placeholder={t('customer.registerDay')}
              error={renewalErrors.renewalDay}
              fitSheetToContent
              required
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
            {searchQuery.length > 0 ? (
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

      {loading ? (
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
        animationType="fade"
        onRequestClose={handleClosePaymentModal}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable style={styles.centeredModalBackdrop} onPress={handleClosePaymentModal} />
          <View style={styles.centeredModalContainer}>
            <View style={styles.centeredModalHeader}>
              <Text style={styles.paymentModalTitle}>{t('collection.submitPayment')}</Text>
              <TouchableOpacity onPress={handleClosePaymentModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
            {selectedCollection ? (
              <View style={styles.centeredModalBody}>
                <KeyboardAwareScrollView
                  style={styles.centeredModalScrollView}
                  contentContainerStyle={styles.centeredModalContent}
                  keyboardShouldPersistTaps="handled"
                  enableOnAndroid
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
                  <View style={styles.inputFieldContainer}>
                    <Text style={styles.fieldLabel}>{t('collection.collectedAmount')} *</Text>
                    <TextInput
                      style={[styles.inputField, paymentErrors.collectedAmount && styles.inputFieldError]}
                      placeholder={t('collection.enterAmount')}
                      placeholderTextColor={COLORS.text.tertiary}
                      value={collectedAmount}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        const digitsOnly = text.replace(/[^0-9]/g, '');
                        setCollectedAmount(digitsOnly);
                        if (paymentErrors.collectedAmount) {
                          setPaymentErrors((prev) => ({ ...prev, collectedAmount: '' }));
                        }
                      }}
                    />
                    {paymentErrors.collectedAmount ? (
                      <Text style={styles.errorTextSmall}>{paymentErrors.collectedAmount}</Text>
                    ) : null}
                  </View>
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
    width: 110,
    flexShrink: 0,
    justifyContent: 'center',
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
  },
  listItemPending: {
    borderColor: '#F5D000',
    borderWidth: 2,
  },
  collectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginBottom: 0,
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
  centeredModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  centeredModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  centeredModalContainer: {
    width: '90%',
    maxWidth: 400,
    height: '75%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
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
    flex: 1,
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
    height: 48,
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

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../api/apiClient';
import apiServices from '../../api/services/apiServices';
import Button from '../../components/common/Button';
import FormPicker from '../../components/common/FormPicker';
import Header from '../../components/common/Header';
import ImagePreviewModal from '../../components/common/ImagePreviewModal';
import ImageProcessingLoader from '../../components/common/ImageProcessingLoader';
import Input from '../../components/common/Input';
import { applyCalendarTimezoneFromResponse } from '../../config/appToggles';
import { COLORS, SIZES } from '../../constants/theme';
import { DEBOUNCE_MS_DEFAULT } from '../../hooks/useDebouncedValue';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError, showSuccess } from '../../utils/alertService';
import { guardAttendanceGatedEntry } from '../../utils/attendanceEntryGate';
import { getRegisterDayNameFromDate } from '../../utils/dateFormatter';
import { pickFromCamera, pickFromLibrary } from '../../utils/imagePickerHelper';
import { safeGoBack } from '../../utils/navigationHelpers';

const CustomerWithLoanScreen = ({ navigation }) => {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  // New vs Existing
  const [customerType, setCustomerType] = useState('New');
  const [existingSearch, setExistingSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const searchDebounceRef = useRef(null);
  const pickingImageRef = useRef(false);
  const [pickingImageType, setPickingImageType] = useState(null);
  const [showExistingLoanForm, setShowExistingLoanForm] = useState(false);
  // console.log('searchResult', searchResult);
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const resetExistingLoanEntryFields = useCallback(() => {
    setLoanAmount('');
    setAathayamAmount('');
    setMagimaiAmount('');
    setCustomerPhoto(null);
    setAddressProof(null);
    setErrors({});
  }, []);

  /** Show check-in popup on field interaction; returns true when allowed. */
  const ensureCheckedInForInteraction = useCallback(() => {
    if (guardAttendanceGatedEntry(t)) return true;
    dismissKeyboard();
    return false;
  }, [t, dismissKeyboard]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && pickingImageRef.current) {
        pickingImageRef.current = false;
        dismissKeyboard();
      }
    });
    return () => subscription.remove();
  }, [dismissKeyboard]);

  // Form states
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [cityId, setCityId] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [showAddCityModal, setShowAddCityModal] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [addingCity, setAddingCity] = useState(false);
  const [addCityError, setAddCityError] = useState('');
  const addCityInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const stepYRef = useRef({});
  const navOpenedRef = useRef(null);
  const navContextRef = useRef({});
  const phoneAutoAdvancedRef = useRef(false);
  const loanPeriodRef = useRef(null);
  const phoneRef = useRef(null);
  const nameRef = useRef(null);
  const addressRef = useRef(null);
  const loanAmountRef = useRef(null);
  const aathayamRef = useRef(null);
  const magimaiRef = useRef(null);
  const existingSearchRef = useRef(null);
  const [loanTypePickerOpen, setLoanTypePickerOpen] = useState(false);
  const [registerDayPickerOpen, setRegisterDayPickerOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  /** Aathayam — sent as `processing_fees` */
  const [aathayamAmount, setAathayamAmount] = useState('');
  /** Magimai — sent as `intrest_amount` */
  const [magimaiAmount, setMagimaiAmount] = useState('');
  const [loanTypeId, setLoanTypeId] = useState('');
  const [loanPeriod, setLoanPeriod] = useState('');
  const [addressLatitude, setAddressLatitude] = useState('');
  const [addressLongitude, setAddressLongitude] = useState('');
  // Loan types from API (for dropdown)
  const [loanTypeOptions, setLoanTypeOptions] = useState([]);
  const [loanTypesLoading, setLoanTypesLoading] = useState(false);
  const [isLoanTypeDisabled, setIsLoanTypeDisabled] = useState(false);
  const [isLoanPeriodDisabled, setIsLoanPeriodDisabled] = useState(false);

  // File states
  const [aadharImage, setAadharImage] = useState(null);
  const [customerPhoto, setCustomerPhoto] = useState(null);
  const [addressProof, setAddressProof] = useState(null);
  const [searchedCustomerId, setSearchedCustomerId] = useState(null);
  // console.log('searchedCustomerId', searchedCustomerId);
  // UI states
  const [loading, setLoading] = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [errors, setErrors] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [registerDay, setRegisterDay] = useState(() => getRegisterDayNameFromDate());
  const [serverRegisterDay, setServerRegisterDay] = useState(() => getRegisterDayNameFromDate());
  const registerDayOptions = useMemo(
    () => [
      { label: 'Monday', value: 'Monday' },
      { label: 'Tuesday', value: 'Tuesday' },
      { label: 'Wednesday', value: 'Wednesday' },
      { label: 'Thursday', value: 'Thursday' },
      { label: 'Friday', value: 'Friday' },
      { label: 'Saturday', value: 'Saturday' },
      { label: 'Sunday', value: 'Sunday' },
    ],
    [],
  );
  const loanDayOptions = registerDayOptions;

  const loadCities = useCallback(async () => {
    setCitiesLoading(true);
    try {
      const list = await apiServices.city.getActiveList();
      const options = (Array.isArray(list) ? list : []).map((item) => ({
        label: String(item.city_name ?? '').trim(),
        value: String(item.id),
      })).filter((item) => item.label);
      setCityOptions(options);
      return options;
    } catch (err) {
      setCityOptions([]);
      showError(t('common.error'), getApiErrorMessage(err, t('customer.loadingCities')));
      return [];
    } finally {
      setCitiesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (customerType !== 'New') return undefined;
    loadCities();
    return undefined;
  }, [customerType, loadCities]);

  useEffect(() => {
    if (!showAddCityModal) return undefined;
    const timer = setTimeout(() => addCityInputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, [showAddCityModal]);

  const handleOpenAddCity = () => {
    setNewCityName('');
    setAddCityError('');
    setShowAddCityModal(true);
  };

  const handleCloseAddCity = () => {
    if (addingCity) return;
    setShowAddCityModal(false);
    setNewCityName('');
    setAddCityError('');
    setTimeout(() => setCityPickerVisible(true), 350);
  };

  const handleAddCity = async () => {
    const name = String(newCityName || '').trim();
    if (!name) {
      setAddCityError(t('customer.cityNameRequired'));
      return;
    }
    setAddingCity(true);
    setAddCityError('');
    try {
      const res = await apiServices.city.create(name);
      const created = res?.data ?? res;
      const createdId = created?.id != null ? String(created.id) : '';
      const options = await loadCities();
      if (createdId) {
        setCityId(createdId);
      } else if (options.length) {
        const match = options.find(
          (opt) => opt.label.toLowerCase() === name.toLowerCase(),
        );
        if (match) setCityId(match.value);
      }
      if (errors.cityId) setErrors((prev) => ({ ...prev, cityId: null }));
      setShowAddCityModal(false);
      setNewCityName('');
      setTimeout(() => setCityPickerVisible(true), 350);
    } catch (err) {
      setAddCityError(getApiErrorMessage(err, t('errors.somethingWentWrong')));
    } finally {
      setAddingCity(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await apiServices.app.getVersion({ skipGlobalLoader: true });
          if (!cancelled) applyCalendarTimezoneFromResponse(res);
        } catch {
          // Fall back to cached server_date or device date
        }
        if (!cancelled) {
          setServerRegisterDay(getRegisterDayNameFromDate());
        }
      })();
      return () => { cancelled = true; };
    }, []),
  );
  // Fetch loan types from API (New + Existing customer forms)
  useEffect(() => {
    let cancelled = false;
    setLoanTypesLoading(true);
    apiServices.loan
      .getLoanTypes()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          const options = list.map((item) => ({
            label: item.loan_type ?? String(item.id),
            value: String(item.id),
          }));
          setLoanTypeOptions(options);

          if (customerType !== 'New') return;

          // Load stored loan data and handle login response (New customer only)
          const loadStoredLoanData = async () => {
            try {
              const storedLoanType = await AsyncStorage.getItem('loanType');
              const storedLoanPeriod = await AsyncStorage.getItem('loanPeriod');

              // If no stored data, try to get from login response
              if (!storedLoanType) {
                const loginResponse = await AsyncStorage.getItem('loginResponse');
                if (loginResponse) {
                  const loginData = JSON.parse(loginResponse);
                  const loginLoanType = loginData?.data?.loan_type;
                  const loginLoanPeriod = loginData?.data?.loan_period;

                  if (loginLoanType) {
                    // Find matching loan type from API list
                    const matchingLoanType = options.find(option =>
                      option.label.toLowerCase() === loginLoanType.toLowerCase()
                    );

                    if (matchingLoanType) {
                      // Auto-select the matching loan type
                      setLoanTypeId(matchingLoanType.value);
                      setIsLoanTypeDisabled(true);

                      // Store for future use
                      await AsyncStorage.setItem('loanType', matchingLoanType.value);

                      // For daily loans, set and disable period
                      if (loginLoanType.toLowerCase() === 'daily' && loginLoanPeriod) {
                        setLoanPeriod(loginLoanPeriod);
                        setIsLoanPeriodDisabled(true);
                        await AsyncStorage.setItem('loanPeriod', loginLoanPeriod);
                      }
                    }
                  }
                }
              } else {
                // Use stored data if available
                setLoanTypeId(storedLoanType);
                setIsLoanTypeDisabled(true);
                if (storedLoanPeriod) {
                  setLoanPeriod(storedLoanPeriod);
                  setIsLoanPeriodDisabled(true);
                }
              }
            } catch {
              // Non-blocking: loan type list still usable without stored defaults
            }
          };

          loadStoredLoanData();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoanTypeOptions([]);
          showError(t('common.error'), getApiErrorMessage(err, t('customer.loadingLoanTypes')));
        }
      })
      .finally(() => {
        if (!cancelled) setLoanTypesLoading(false);
      });
    return () => { cancelled = true; };
  }, [customerType, t]);

  const existingLoanTypeOptions = useMemo(
    () => loanTypeOptions.filter((option) => {
      const lower = String(option.label).toLowerCase();
      return lower === 'daily' || lower === 'weekly';
    }),
    [loanTypeOptions],
  );

  useEffect(() => {
    if (customerType !== 'Existing') return;
    let cancelled = false;
    const loadDefaults = async () => {
      try {
        const storedLoanType = await AsyncStorage.getItem('loanType');
        const storedLoanPeriod = await AsyncStorage.getItem('loanPeriod');
        if (!cancelled) {
          if (storedLoanType) setLoanTypeId(storedLoanType);
          if (storedLoanPeriod) setLoanPeriod(storedLoanPeriod);
          setIsLoanTypeDisabled(false);
          setIsLoanPeriodDisabled(false);
        }
      } catch {
        // Non-blocking defaults for existing-customer flow
      }
    };
    loadDefaults();
    return () => { cancelled = true; };
  }, [customerType]);

  const runCustomerSearch = useCallback(async (query) => {
    const q = (query || existingSearch || '').trim();
    if (!q) {
      setSearchResult(null);
      setSearchError(null);
      setShowExistingLoanForm(false);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setShowExistingLoanForm(false);
    setSearchedCustomerId(null);
    try {
      // const lineId = await AsyncStorage.getItem('lineId');
      // const selectedLabel = loanTypeOptions.find((o) => o.value === loanTypeId)?.label ?? '';
      // const loanTypeFilter = String(selectedLabel).toLowerCase();
      // const filters = {};
      // if (loanTypeFilter === 'daily' || loanTypeFilter === 'weekly') {
      //   filters.loan_type = loanTypeFilter;
      // }
      // if (loanTypeFilter === 'weekly' && registerDay) {
      //   filters.register_day = registerDay;
      // }
      // const lineId = '22';
      const lineId = await AsyncStorage.getItem('lineId');
      const filters = {};
      if (loanTypeId) {
        filters.loan_type = String(loanTypeId);
      }
      const selectedLabel = loanTypeOptions.find((o) => o.value === loanTypeId)?.label ?? '';
      const loanTypeFilter = String(selectedLabel).toLowerCase();
      if (loanTypeFilter === 'weekly' && registerDay) {
        filters.register_day = registerDay;
      }
      const response = await apiServices.customer.searchCustomer(q, lineId, filters);
      const data = response?.data ?? response;
      const normalizedResults = Array.isArray(data) ? data : data ? [data] : [];
      setSearchResult(normalizedResults);
      if (normalizedResults.length === 1) {
        const singleCustomer = normalizedResults[0];
        const singleCustomerHasOpenLoans = Array.isArray(singleCustomer?.open_loans) && singleCustomer.open_loans.length > 0;
        setSearchedCustomerId(singleCustomer?.id ?? null);
        resetExistingLoanEntryFields();
        setShowExistingLoanForm(!singleCustomerHasOpenLoans);
      } else {
        setSearchedCustomerId(null);
        setShowExistingLoanForm(false);
      }
      if (!normalizedResults.length) setSearchError(t('customer.noCustomerFound'));
    } catch (err) {
      setSearchResult(null);
      setSearchError(getApiErrorMessage(err, t('customer.searchFailed')));
    } finally {
      setSearchLoading(false);
    }
  }, [existingSearch, loanTypeId, loanTypeOptions, registerDay, resetExistingLoanEntryFields, t]);

  useEffect(() => {
    if (customerType !== 'Existing') return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = existingSearch.trim();
    if (!q) {
      setSearchResult(null);
      setSearchError(null);
      return;
    }
    searchDebounceRef.current = setTimeout(() => runCustomerSearch(q), DEBOUNCE_MS_DEFAULT);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [customerType, existingSearch, loanTypeId, registerDay, runCustomerSearch]);

  const searchResults = useMemo(
    () => (Array.isArray(searchResult) ? searchResult : searchResult ? [searchResult] : []),
    [searchResult],
  );
  const selectedExistingCustomer = useMemo(() => {
    if (!searchResults.length) return null;
    if (searchedCustomerId != null) {
      return searchResults.find((item) => String(item?.id) === String(searchedCustomerId)) ?? null;
    }
    return searchResults.length === 1 ? searchResults[0] : null;
  }, [searchResults, searchedCustomerId]);
  const selectedCustomerHasOpenLoans = Array.isArray(selectedExistingCustomer?.open_loans) && selectedExistingCustomer.open_loans.length > 0;
  const canSubmitLoanForExisting = !!selectedExistingCustomer && !selectedCustomerHasOpenLoans;

  // console.log('canSubmitLoanForExisting', hasOpenLoans);
  // Period unit for Loan Period label (e.g. "days", "weeks", "months") from selected loan type
  const selectedLoanTypeLabel = loanTypeOptions.find((o) => o.value === loanTypeId)?.label ?? '';
  const periodUnit = (() => {
    const lower = String(selectedLoanTypeLabel).toLowerCase();
    if (lower === 'daily') return t('loan.days') || 'days';
    if (lower === 'weekly') return t('loan.weeks') || 'weeks';
    if (lower === 'monthly') return t('loan.months') || 'months';
    return t('loan.months') || 'months';
  })();
  const isWeeklyLoanType = String(selectedLoanTypeLabel).toLowerCase() === 'weekly';
  const loanTypeParam = loanTypeId ? String(loanTypeId) : '';

  navContextRef.current = {
    customerType,
    isWeeklyLoanType,
    isLoanPeriodDisabled,
    showExistingLoanForm,
    loanTypeId,
    loanPeriod,
    registerDay,
    customerPhone,
    customerName,
    customerAddress,
    cityId,
    loanAmount,
    aathayamAmount,
    magimaiAmount,
    aadharImage,
    customerPhoto,
    addressProof,
    existingSearch,
  };

  useEffect(() => {
    if (!isWeeklyLoanType) {
      setRegisterDay('');
      setErrors((prev) => (prev.registerDay ? { ...prev, registerDay: null } : prev));
      return;
    }
    setRegisterDay(getRegisterDayNameFromDate());
  }, [isWeeklyLoanType, serverRegisterDay]);

  // Handle phone input change (same as LoginScreen)
  const handlePhoneChange = (text) => {
    const numericValue = text.replace(/[^0-9]/g, '');

    if (numericValue.length > 0) {
      const firstDigit = parseInt(numericValue[0], 10);
      if (firstDigit <= 5) {
        return;
      }
    }

    if (numericValue.length > 10) {
      return;
    }

    const previousLength = String(customerPhone || '').replace(/[^0-9]/g, '').length;
    setCustomerPhone(numericValue);
    if (errors.customerPhone) {
      setErrors({ ...errors, customerPhone: null });
    }

    const isValidCompletePhone = /^[6-9]\d{9}$/.test(numericValue);
    if (isValidCompletePhone && previousLength < 10 && !phoneAutoAdvancedRef.current) {
      phoneAutoAdvancedRef.current = true;
      goToNextFrom('phone');
      return;
    }

    if (numericValue.length < 10) {
      phoneAutoAdvancedRef.current = false;
    }
  };

  const recordStepY = (step) => (event) => {
    stepYRef.current[step] = event.nativeEvent.layout.y;
  };

  const scrollToStep = (step) => {
    const y = stepYRef.current[step];
    if (y == null) return;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  const getFormSteps = () => {
    const ctx = navContextRef.current;
    if (ctx.customerType === 'Existing') {
      const steps = ['loanType'];
      if (ctx.isWeeklyLoanType) steps.push('registerDay');
      steps.push('search');
      if (ctx.showExistingLoanForm) {
        steps.push('loanAmount', 'magimai', 'aathayam', 'customerPhoto', 'addressProof');
      }
      return steps;
    }
    const steps = ['loanType', 'loanPeriod'];
    if (ctx.isWeeklyLoanType) steps.push('registerDay');
    steps.push(
      'phone',
      'name',
      'address',
      'city',
      'loanAmount',
      'aathayam',
      'magimai',
      'aadhar',
      'customerPhoto',
      'addressProof',
    );
    return steps;
  };

  const goToStep = (step) => {
    const ctx = navContextRef.current;
    scrollToStep(step);

    switch (step) {
      case 'loanType': {
        if (ctx.loanTypeId) {
          goToNextFrom('loanType');
          return;
        }
        Keyboard.dismiss();
        navOpenedRef.current = 'loanType';
        setLoanTypePickerOpen(true);
        return;
      }
      case 'loanPeriod': {
        if (ctx.isLoanPeriodDisabled) {
          goToNextFrom('loanPeriod');
          return;
        }
        setTimeout(() => loanPeriodRef.current?.focus(), 350);
        return;
      }
      case 'registerDay': {
        if (ctx.registerDay) {
          goToNextFrom('registerDay');
          return;
        }
        if (ctx.customerType === 'New') {
          goToNextFrom('registerDay');
          return;
        }
        Keyboard.dismiss();
        navOpenedRef.current = 'registerDay';
        setRegisterDayPickerOpen(true);
        return;
      }
      case 'phone':
        setTimeout(() => phoneRef.current?.focus(), 80);
        return;
      case 'name':
        setTimeout(() => nameRef.current?.focus(), 80);
        return;
      case 'address':
        setTimeout(() => addressRef.current?.focus(), 80);
        return;
      case 'city': {
        if (ctx.cityId) {
          goToNextFrom('city');
          return;
        }
        Keyboard.dismiss();
        navOpenedRef.current = 'city';
        setCityPickerVisible(true);
        return;
      }
      case 'loanAmount':
        setTimeout(() => loanAmountRef.current?.focus(), 80);
        return;
      case 'aathayam':
        setTimeout(() => aathayamRef.current?.focus(), 80);
        return;
      case 'magimai':
        setTimeout(() => magimaiRef.current?.focus(), 80);
        return;
      case 'search':
        setTimeout(() => existingSearchRef.current?.focus(), 80);
        return;
      case 'aadhar':
      case 'customerPhoto':
      case 'addressProof': {
        Keyboard.dismiss();
        const imageValue =
          step === 'aadhar' ? ctx.aadharImage : step === 'customerPhoto' ? ctx.customerPhoto : ctx.addressProof;
        setTimeout(() => {
          scrollToStep(step);
          if (imageValue) {
            goToNextFrom(step);
            return;
          }
          navOpenedRef.current = step;
          const imageType = step === 'aadhar' ? 'aadhar' : step === 'customerPhoto' ? 'customer' : 'address';
          handleImagePick(imageType, 'camera');
        }, 250);
        return;
      }
      default:
        return;
    }
  };

  const goToNextFrom = (step) => {
    const steps = getFormSteps();
    const index = steps.indexOf(step);
    if (index < 0 || index >= steps.length - 1) return;
    goToStep(steps[index + 1]);
  };

  const continueIfOpenedByNav = (step) => {
    if (navOpenedRef.current !== step) return;
    navOpenedRef.current = null;
    setTimeout(() => goToNextFrom(step), 300);
  };

  // Validation (New customer only)
  const validateNewForm = () => {
    const newErrors = {};

    if (!customerPhone) {
      newErrors.customerPhone = t('customer.phoneRequired');
    } else if (customerPhone.length !== 10) {
      newErrors.customerPhone = t('customer.phoneInvalid');
    } else {
      const firstDigit = parseInt(customerPhone[0]);
      if (firstDigit <= 5) {
        newErrors.customerPhone = t('customer.phoneInvalidStart');
      }
    }
    if (!customerName.trim()) newErrors.customerName = t('customer.nameRequired');
    if (!customerAddress.trim()) newErrors.customerAddress = t('customer.addressRequired');
    if (!cityId) newErrors.cityId = t('customer.cityRequired');
    if (!loanAmount.trim() || parseFloat(loanAmount) <= 0) {
      newErrors.loanAmount = t('customer.loanAmountRequired');
    }
    const parseNonNegativeAmount = (raw) => {
      const s = String(raw ?? '').trim();
      if (s === '') return { ok: false, reason: 'empty' };
      const n = parseFloat(s);
      if (Number.isNaN(n) || n < 0) return { ok: false, reason: 'invalid' };
      return { ok: true, value: n };
    };
    if (!String(aathayamAmount ?? '').trim()) {
      newErrors.aathayamAmount = t('customer.aathayamRequired');
    } else {
      const aathayamParsed = parseNonNegativeAmount(aathayamAmount);
      if (!aathayamParsed.ok && aathayamParsed.reason === 'invalid') {
        newErrors.aathayamAmount = t('customer.amountInvalidNonNegative');
      }
    }
    if (!String(magimaiAmount ?? '').trim()) {
      newErrors.magimaiAmount = t('customer.magimaiRequired');
    } else {
      const magimaiParsed = parseNonNegativeAmount(magimaiAmount);
      if (!magimaiParsed.ok && magimaiParsed.reason === 'invalid') {
        newErrors.magimaiAmount = t('customer.amountInvalidNonNegative');
      }
    }
    if (!loanTypeId) newErrors.loanTypeId = t('customer.loanTypeRequired');
    if (isWeeklyLoanType && !registerDay) {
      newErrors.registerDay = t('customer.registerDayRequired');
    }
    if (!loanPeriod.trim() || parseInt(loanPeriod) <= 0) {
      newErrors.loanPeriod = t('customer.loanPeriodRequired');
    }
    if (!aadharImage) newErrors.aadharImage = t('customer.imageRequired');
    if (!customerPhoto) newErrors.customerPhoto = t('customer.imageRequired');
    if (!addressProof) newErrors.addressProof = t('customer.imageRequired');

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid) {
      dismissKeyboard();
      showError(t('common.error'), t('upfrontCash.fillAllRequiredFields'));
    }
    return isValid;
  };

  const validateExistingCustomer = () => {
    if (!selectedExistingCustomer) {
      showError(t('common.error'), t('customer.noCustomerFound'));
      return false;
    }
    if (selectedCustomerHasOpenLoans) {
      showError(t('common.error'), t('customer.customerHasOpenLoans'));
      return false;
    }
    return true;
  };

  const validateExistingLoanForm = () => {
    const newErrors = {};
    if (!loanAmount.trim() || parseFloat(loanAmount) <= 0) newErrors.loanAmount = t('customer.loanAmountRequired');
    if (!String(magimaiAmount ?? '').trim()) newErrors.magimaiAmount = t('customer.amountInvalidNonNegative') || 'Required';
    if (!String(aathayamAmount ?? '').trim()) newErrors.aathayamAmount = t('customer.amountInvalidNonNegative') || 'Required';
    if (!loanTypeId) newErrors.loanTypeId = t('customer.loanTypeRequired');
    if (isWeeklyLoanType && !registerDay) {
      newErrors.registerDay = t('customer.registerDayRequired');
    }
    if (!loanPeriod.trim() || parseInt(loanPeriod, 10) <= 0) newErrors.loanPeriod = t('customer.loanPeriodRequired');
    if (!customerPhoto) newErrors.customerPhoto = t('customer.imageRequired');
    if (!addressProof) newErrors.addressProof = t('customer.imageRequired');
    setErrors((prev) => ({ ...prev, ...newErrors }));
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid) {
      dismissKeyboard();
      showError(t('common.error'), t('upfrontCash.fillAllRequiredFields'));
    }
    return isValid;
  };

  // Location capture - returns coords so formData uses them (setState is async)
  const captureLocation = async () => {
    setIsCapturingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }
      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = locationData.coords.latitude.toString();
      const lng = locationData.coords.longitude.toString();
      setAddressLatitude(lat);
      setAddressLongitude(lng);
      return { latitude: lat, longitude: lng };
    } catch (error) {
      showError(t('common.error'), getApiErrorMessage(error, t('customer.locationRequired')));
      throw error;
    } finally {
      setIsCapturingLocation(false);
    }
  };

  // Image handlers
  const handleImagePick = async (type, source) => {
    if (!ensureCheckedInForInteraction()) return;
    dismissKeyboard();
    pickingImageRef.current = true;
    setPickingImageType(type);
    try {
      if (source === 'camera') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          showError(t('common.error'), t('customer.imageRequired'));
          return;
        }
        const image = await pickFromCamera();
        if (image) {
          if (type === 'aadhar') setAadharImage(image);
          else if (type === 'customer') setCustomerPhoto(image);
          else if (type === 'address') setAddressProof(image);
          const navStep = type === 'aadhar' ? 'aadhar' : type === 'customer' ? 'customerPhoto' : 'addressProof';
          continueIfOpenedByNav(navStep);
        } else if (navOpenedRef.current === (type === 'aadhar' ? 'aadhar' : type === 'customer' ? 'customerPhoto' : 'addressProof')) {
          navOpenedRef.current = null;
        }
      } else {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          showError(t('common.error'), t('customer.imageRequired'));
          return;
        }
        const image = await pickFromLibrary();
        if (image) {
          if (type === 'aadhar') setAadharImage(image);
          else if (type === 'customer') setCustomerPhoto(image);
          else if (type === 'address') setAddressProof(image);
        }
      }
    } catch (error) {
      showError(t('common.error'), getApiErrorMessage(error, t('customer.imageRequired')));
    } finally {
      pickingImageRef.current = false;
      setPickingImageType(null);
      dismissKeyboard();
    }
  };

  // Form submission
  const handleSubmit = async () => {
    if (!guardAttendanceGatedEntry(t)) return;
    dismissKeyboard();
    if (customerType === 'New') {
      if (!validateNewForm()) return;
    } else {
      if (!validateExistingCustomer()) return;
      if (!showExistingLoanForm) {
        showError(t('common.error'), t('customer.fillRequiredFields') || 'Please open the form and fill required fields.');
        return;
      }
      if (!validateExistingLoanForm()) return;
    }

    const isExisting = customerType === 'Existing';
    setLoading(true);
    try {
      // Get branch_id and line_id from storage (keys match login: branchId, lineId)
      const storedBranchId = await AsyncStorage.getItem('branchId');
      const storedLineId = await AsyncStorage.getItem('lineId');

      if (!storedBranchId || !storedLineId) {
        showError(t('common.error'), t('errors.unauthorized'));
        setLoading(false);
        return;
      }

      // Capture location and use returned coords (state may not update in time)
      let coords;
      try {
        coords = await captureLocation();
      } catch {
        setLoading(false);
        return;
      }
      const lat = String(coords?.latitude ?? '12.9716');
      const lng = String(coords?.longitude ?? '77.5946');

      const getFileName = (uri, fallback) => {
        const name = uri?.split?.('/')?.pop?.()?.split?.('?')?.[0];
        return (name && name.length > 0) ? name : fallback;
      };
      const aathayamNum = String(aathayamAmount ?? '').trim() === '' ? 0 : Number(aathayamAmount) || 0;
      const magimaiNum = String(magimaiAmount ?? '').trim() === '' ? 0 : Number(magimaiAmount) || 0;

      // Use correct MIME so backend receives binary image with proper Content-Type
      const getImageType = (uri, defaultName) => {
        const name = (uri ?? '').toLowerCase();
        return name.includes('.png') ? 'image/png' : 'image/jpeg';
      };

      if (customerType === 'Existing') {
        const customerId = selectedExistingCustomer?.id ?? searchedCustomerId;
        if (!customerId) {
          showError(t('common.error'), t('customer.noCustomerFound'));
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('loan_amount', String(Number(loanAmount) || 0));
        formData.append('loan_period', String(Number(loanPeriod) || 0));
        formData.append('loantype_id', String(Number(loanTypeId) || 0));
        if (loanTypeParam) formData.append('loan_type', loanTypeParam);
        formData.append('processing_fees', String(magimaiNum));
        formData.append('intrest_amount', String(aathayamNum));
        if (isWeeklyLoanType && registerDay) {
          formData.append('register_day', String(registerDay));
          // formData.append('register_day', String(2));

        }

        if (customerPhoto) {
          const name = getFileName(customerPhoto.uri, 'customer_photo.png');
          formData.append('customer_photo', {
            uri: customerPhoto.uri,
            name,
            type: getImageType(customerPhoto.uri, name),
          });
        }
        if (addressProof) {
          const name = getFileName(addressProof.uri, 'address_proof.png');
          formData.append('address_proof', {
            uri: addressProof.uri,
            name,
            type: getImageType(addressProof.uri, name),
          });
        }

        console.log('📤 Existing customer loan request payload', {
          endpoint: `/loan/existing-customer/${customerId}`,
          fields: {
            loan_amount: String(Number(loanAmount) || 0),
            loan_period: String(Number(loanPeriod) || 0),
            loantype_id: String(Number(loanTypeId) || 0),
            loan_type: loanTypeParam || null,
            processing_fees: String(magimaiNum),
            intrest_amount: String(aathayamNum),
            register_day: isWeeklyLoanType && registerDay ? String(registerDay) : null,
          },
          files: {
            customer_photo: customerPhoto ? getFileName(customerPhoto.uri, 'customer_photo.png') : null,
            address_proof: addressProof ? getFileName(addressProof.uri, 'address_proof.png') : null,
          },
        });

        const response = await apiClient.post(`/loan/existing-customer/${customerId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const data = response?.data ?? response;
        const success = data?.success !== false && (data?.status !== 400 && data?.status !== 500);
        const message = data?.message || 'Loan request created successfully!';
        if (success) {
          showSuccess(t('common.success'), message, [{ text: 'OK', onPress: () => safeGoBack(navigation) }]);
        } else {
          showError(t('common.error'), message || t('errors.somethingWentWrong'));
        }
        return;
      }

      // New customer flow (POST /customer/with-loan)
      const formData = new FormData();
      formData.append('customer_type', 'new');
      formData.append('customer_name', String(customerName));
      formData.append('customer_phone', String(customerPhone));
      formData.append('customer_address', String(customerAddress));
      formData.append('city_id', String(cityId || ''));
      formData.append('loan_amount', String(Number(loanAmount) || 0));
      formData.append('loan_period', String(Number(loanPeriod) || 12));
      formData.append('loantype_id', String(Number(loanTypeId) || 1));
      if (loanTypeParam) formData.append('loan_type', loanTypeParam);
      formData.append('processing_fees', String(magimaiNum));
      formData.append('intrest_amount', String(aathayamNum));
      formData.append('address_latitude', lat);
      formData.append('address_longitude', lng);
      if (isWeeklyLoanType && registerDay) {
        formData.append('register_day', String(registerDay));
      }

      if (aadharImage) {
        const name = getFileName(aadharImage.uri, 'aadhar_image.png');
        formData.append('aadhar_image', {
          uri: aadharImage.uri,
          name,
          type: getImageType(aadharImage.uri, name),
        });
      }
      if (customerPhoto) {
        const name = getFileName(customerPhoto.uri, 'customer_photo.png');
        formData.append('customer_photo', {
          uri: customerPhoto.uri,
          name,
          type: getImageType(customerPhoto.uri, name),
        });
      }
      if (addressProof) {
        const name = getFileName(addressProof.uri, 'address_proof.png');
        formData.append('address_proof', {
          uri: addressProof.uri,
          name,
          type: getImageType(addressProof.uri, name),
        });
      }

      console.log('📤 CustomerWithLoan POST payload', {
        endpoint: '/api/v1/customer/with-loan',
        fields: {
          customer_type: isExisting ? 'existing' : 'new',
          customer_id: isExisting ? (selectedExistingCustomer?.customer_id ?? selectedExistingCustomer?.id ?? selectedExistingCustomer?.customer_no ?? null) : null,
          customer_name: String(isExisting ? (selectedExistingCustomer?.customer_name ?? '') : customerName),
          customer_phone: String(isExisting ? (selectedExistingCustomer?.customer_phone ?? existingSearch ?? '') : customerPhone),
          customer_address: String(isExisting ? (selectedExistingCustomer?.customer_address ?? '') : customerAddress),
          city_id: cityId || null,
          loan_amount: String(Number(loanAmount) || 0),
          loan_period: String(Number(loanPeriod) || 12),
          loantype_id: String(Number(loanTypeId) || 1),
          loan_type: loanTypeParam || null,
          processing_fees: String(magimaiNum),
          intrest_amount: String(aathayamNum),
          address_latitude: lat,
          address_longitude: lng,
          register_day: isWeeklyLoanType && registerDay ? String(registerDay) : null,
          branch_id: storedBranchId,
          line_id: storedLineId,
        },
        mapping: {
          aathayamAmount_Aathayam: aathayamAmount,
          magimaiAmount_Magimai: magimaiAmount,
          processing_fees_from_aathayamNum: String(aathayamNum),
          intrest_amount_from_magimaiNum: String(magimaiNum),
        },
        files: {
          aadhar_image: !isExisting && aadharImage ? getFileName(aadharImage.uri, 'aadhar_image.png') : null,
          customer_photo: !isExisting && customerPhoto ? getFileName(customerPhoto.uri, 'customer_photo.png') : null,
          address_proof: !isExisting && addressProof ? getFileName(addressProof.uri, 'address_proof.png') : null,
        },
        note: 'branch_id & line_id also re-appended in apiServices from AsyncStorage as strings.',
      });

      const response = await apiServices.customer.createCustomerWithLoan(formData);
      const success = response?.success !== false && (response?.status !== 400 && response?.status !== 500);
      const message = response?.message || 'Customer and loan created successfully!';

      if (success) {
        showSuccess(t('common.success'), message || t('success.customerCreated'), [
          { text: 'OK', onPress: () => safeGoBack(navigation) },
        ]);
      } else {
        showError(t('common.error'), response?.message || message || t('errors.somethingWentWrong'));
      }
    } catch (error) {
      showError(t('common.error'), getApiErrorMessage(error, t('errors.somethingWentWrong')));
    } finally {
      setLoading(false);
    }
  };

  const renderImageSection = (title, image, imageType, errorKey, required = false) => {
    const isPicking = pickingImageType === imageType;
    return (
      <View style={styles.imageSection}>
        <Text style={styles.imageLabel}>
          {title}
          {required ? <Text style={styles.imageLabelRequired}> *</Text> : null}
        </Text>
        {image ? (
          <View style={styles.imagePreview}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => !isPicking && setPreviewImage({ uri: image.uri, title })} disabled={isPicking}>
              <Image source={{ uri: image.uri }} style={styles.image} />
              <View style={styles.previewHint}>
                <Ionicons name="expand-outline" size={12} color={COLORS.white} />
                <Text style={styles.previewHintText}>Preview</Text>
              </View>
            </TouchableOpacity>
            {!isPicking && (
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => {
                  switch (imageType) {
                    case 'aadhar':
                      setAadharImage(null);
                      break;
                    case 'customer':
                      setCustomerPhoto(null);
                      break;
                    case 'address':
                      setAddressProof(null);
                      break;
                  }
                }}
              >
                <Ionicons name="close-circle" size={24} color={COLORS.white} />
              </TouchableOpacity>
            )}
            {isPicking ? <ImageProcessingLoader message={t('common.processingImage')} /> : null}
          </View>
        ) : (
          <View style={styles.imageOptionsWrap}>
            {!isPicking ? (
              <View style={styles.imageOptions}>
                <TouchableOpacity
                  style={styles.imageOptionButton}
                  onPress={() => {
                    dismissKeyboard();
                    handleImagePick(imageType, 'camera');
                  }}
                >
                  <Ionicons name="camera" size={30} color={COLORS.primary} />
                  <Text style={styles.imageOptionText}>{t('customer.takePhoto')}</Text>
                </TouchableOpacity>
                {/* <TouchableOpacity
                  style={styles.imageOptionButton}
                  onPress={() => {
                    dismissKeyboard();
                    handleImagePick(imageType, 'gallery');
                  }}
                >
                  <Ionicons name="image-outline" size={30} color={COLORS.primary} />
                  <Text style={styles.imageOptionText}>{t('customer.chooseFromLibrary')}</Text>
                </TouchableOpacity> */}
              </View>
            ) : null}
            {isPicking ? <ImageProcessingLoader message={t('common.processingImage')} /> : null}
          </View>
        )}
        {errors[errorKey] && (
          <Text style={styles.errorText}>{errors[errorKey]}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('customer.createCustomerWithLoan')}
        showBackButton={true}
        onBackPress={() => safeGoBack(navigation)}
      />

      {/* New / Existing radio */}
      <View style={styles.radioRow}>
        <TouchableOpacity
          style={[styles.radioOption, customerType === 'New' && styles.radioOptionActive]}
          onPress={() => {
            setCustomerType('New');
            setSearchResult(null);
            setSearchError(null);
            setExistingSearch('');
            setShowExistingLoanForm(false);
          }}
        >
          <View style={[styles.radioCircle, customerType === 'New' && styles.radioCircleActive]}>
            {customerType === 'New' && <View style={styles.radioCircleInner} />}
          </View>
          <Text style={[styles.radioLabel, customerType === 'New' && styles.radioLabelActive]}>{t('customer.newCustomer')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.radioOption, customerType === 'Existing' && styles.radioOptionActive]}
          onPress={() => {
            setCustomerType('Existing');
            setErrors({});
            setShowExistingLoanForm(false);
            setLoanAmount('');
            setAathayamAmount('');
            setMagimaiAmount('');
            setCustomerPhoto(null);
            setAddressProof(null);
            setAadharImage(null);
            setRegisterDay('');
            setLoanTypeId('');
          }}
        >
          <View style={[styles.radioCircle, customerType === 'Existing' && styles.radioCircleActive]}>
            {customerType === 'Existing' && <View style={styles.radioCircleInner} />}
          </View>
          <Text style={[styles.radioLabel, customerType === 'Existing' && styles.radioLabelActive]}>{t('customer.existingCustomer')}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          {customerType === 'New' && (
            <>
              <View onLayout={recordStepY('loanType')}>
                <FormPicker
                  label={t('customer.loanType')}
                  value={loanTypeId}
                  onValueChange={(value) => {
                    setLoanTypeId(value);
                    continueIfOpenedByNav('loanType');
                  }}
                  items={loanTypeOptions}
                  placeholder={loanTypesLoading ? t('customer.loadingLoanTypes') || 'Loading...' : (language === 'en' ? 'Select loan type' : 'கடன் வகையை தேர்ந்தெடுக்கவும்')}
                  error={errors.loanTypeId}
                  onOpen={ensureCheckedInForInteraction}
                  visible={loanTypePickerOpen}
                  onVisibleChange={(open) => {
                    setLoanTypePickerOpen(open);
                    if (!open && navOpenedRef.current === 'loanType' && !navContextRef.current.loanTypeId) {
                      navOpenedRef.current = null;
                    }
                  }}
                  required
                />
              </View>

              <View onLayout={recordStepY('loanPeriod')}>
                <Input
                  ref={loanPeriodRef}
                  label={`${t('customer.loanPeriod')} (${periodUnit})`}
                  value={loanPeriod}
                  onChangeText={setLoanPeriod}
                  onFocus={ensureCheckedInForInteraction}
                  placeholder={language === 'en' ? 'Enter period' : 'காலத்தை உள்ளிடவும்'}
                  placeholderTextColor={COLORS.text.tertiary}
                  keyboardType="numeric"
                  error={errors.loanPeriod}
                  disabled={isLoanPeriodDisabled}
                  required
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => goToNextFrom('loanPeriod')}
                />
              </View>

              {isWeeklyLoanType && (
                <View onLayout={recordStepY('registerDay')}>
                  <FormPicker
                    label={t('customer.registerDay')}
                    value={registerDay}
                    onValueChange={(value) => {
                      setRegisterDay(value);
                      continueIfOpenedByNav('registerDay');
                    }}
                    items={loanDayOptions}
                    placeholder={t('customer.selectRegisterDay')}
                    error={errors.registerDay}
                    editable={false}
                    required
                  />
                </View>
              )}

              <View onLayout={recordStepY('phone')}>
                <Input
                  ref={phoneRef}
                  label={t('customer.customerPhone')}
                  value={customerPhone}
                  onChangeText={handlePhoneChange}
                  onFocus={ensureCheckedInForInteraction}
                  placeholder={language === 'en' ? '10 digit mobile number' : '10 இலக்க மொபைல் எண்ணை'}
                  placeholderTextColor={COLORS.text.tertiary}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={10}
                  error={errors.customerPhone}
                  required
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => goToNextFrom('phone')}
                />
              </View>

              <View onLayout={recordStepY('name')}>
                <Input
                  ref={nameRef}
                  label={t('customer.customerName')}
                  value={customerName}
                  onChangeText={setCustomerName}
                  onFocus={ensureCheckedInForInteraction}
                  placeholder={language === 'en' ? 'Full name' : 'முழு பெயர்'}
                  error={errors.customerName}
                  required
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => goToNextFrom('name')}
                />
              </View>

              <View onLayout={recordStepY('address')}>
                <Input
                  ref={addressRef}
                  label={t('customer.customerAddress')}
                  value={customerAddress}
                  onChangeText={setCustomerAddress}
                  onFocus={ensureCheckedInForInteraction}
                  placeholder={language === 'en' ? 'Full address' : 'முழு முகவரி'}
                  multiline
                  numberOfLines={2}
                  error={errors.customerAddress}
                  required
                  returnKeyType="next"
                  blurOnSubmit
                  submitBehavior="submit"
                  onSubmitEditing={() => goToNextFrom('address')}
                />
              </View>

              <View onLayout={recordStepY('city')}>
                <FormPicker
                  label={t('customer.city')}
                  value={cityId}
                  onValueChange={(value) => {
                    setCityId(value);
                    if (errors.cityId) setErrors((prev) => ({ ...prev, cityId: null }));
                    continueIfOpenedByNav('city');
                  }}
                  items={cityOptions}
                  placeholder={citiesLoading ? t('customer.loadingCities') : t('customer.selectCity')}
                  searchPlaceholder={t('customer.searchCity')}
                  noResultsText={t('customer.noCitiesFound')}
                  error={errors.cityId}
                  searchable
                  loading={citiesLoading}
                  visible={cityPickerVisible}
                  onVisibleChange={(open) => {
                    setCityPickerVisible(open);
                    if (!open && navOpenedRef.current === 'city' && !navContextRef.current.cityId) {
                      navOpenedRef.current = null;
                    }
                  }}
                  onOpen={ensureCheckedInForInteraction}
                  onAddPress={handleOpenAddCity}
                  required
                />
              </View>

              <View onLayout={recordStepY('loanAmount')}>
                <Input
                  ref={loanAmountRef}
                  label={t('customer.loanAmount')}
                  value={loanAmount}
                  onChangeText={setLoanAmount}
                  onFocus={ensureCheckedInForInteraction}
                  placeholder={language === 'en' ? 'Enter amount' : 'தொகையை உள்ளிடவும்'}
                  keyboardType="numeric"
                  error={errors.loanAmount}
                  required
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => goToNextFrom('loanAmount')}
                />
              </View>

              <View onLayout={recordStepY('aathayam')}>
                <Input
                  ref={aathayamRef}
                  label={t('customer.aathayam')}
                  value={aathayamAmount}
                  onChangeText={(text) => {
                    setAathayamAmount(text);
                    if (errors.aathayamAmount) setErrors((prev) => ({ ...prev, aathayamAmount: null }));
                  }}
                  onFocus={ensureCheckedInForInteraction}
                  placeholder={language === 'en' ? 'Enter amount' : 'தொகையை உள்ளிடவும்'}
                  placeholderTextColor={COLORS.text.tertiary}
                  keyboardType="decimal-pad"
                  error={errors.aathayamAmount}
                  required
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => goToNextFrom('aathayam')}
                />
              </View>

              <View onLayout={recordStepY('magimai')}>
                <Input
                  ref={magimaiRef}
                  label={t('customer.magimai')}
                  value={magimaiAmount}
                  onChangeText={(text) => {
                    setMagimaiAmount(text);
                    if (errors.magimaiAmount) setErrors((prev) => ({ ...prev, magimaiAmount: null }));
                  }}
                  onFocus={ensureCheckedInForInteraction}
                  placeholder={language === 'en' ? 'Enter amount' : 'தொகையை உள்ளிடவும்'}
                  placeholderTextColor={COLORS.text.tertiary}
                  keyboardType="decimal-pad"
                  error={errors.magimaiAmount}
                  required
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => goToNextFrom('magimai')}
                />
              </View>

              <View onLayout={recordStepY('aadhar')}>
                {renderImageSection(t('customer.aadharImage'), aadharImage, 'aadhar', 'aadharImage', true)}
              </View>
              <View onLayout={recordStepY('customerPhoto')}>
                {renderImageSection(t('customer.customerPhoto'), customerPhoto, 'customer', 'customerPhoto', true)}
              </View>
              <View onLayout={recordStepY('addressProof')}>
                {renderImageSection(t('customer.addressProof'), addressProof, 'address', 'addressProof', true)}
              </View>
            </>
          )}

          {customerType === 'Existing' && (
            <View style={styles.existingSection}>
              <View style={styles.existingPickerGrid}>
                <View style={styles.existingPickerGridItem} onLayout={recordStepY('loanType')}>


                  <FormPicker
                    label={t('customer.loanType')}
                    value={loanTypeId}
                    onValueChange={(value) => {
                      setLoanTypeId(value);
                      if (errors.loanTypeId) {
                        setErrors((prev) => ({ ...prev, loanTypeId: null }));
                      }
                      continueIfOpenedByNav('loanType');
                    }}
                    items={existingLoanTypeOptions}
                    placeholder={loanTypesLoading ? t('customer.loadingLoanTypes') : t('customer.selectLoanType')}
                    error={errors.loanTypeId}
                    style={styles.existingPickerCompact}
                    onOpen={ensureCheckedInForInteraction}
                    visible={loanTypePickerOpen}
                    onVisibleChange={(open) => {
                      setLoanTypePickerOpen(open);
                      if (!open && navOpenedRef.current === 'loanType' && !navContextRef.current.loanTypeId) {
                        navOpenedRef.current = null;
                      }
                    }}
                    required
                  />
                </View>
                {isWeeklyLoanType && (
                  <View style={styles.existingPickerGridItem} onLayout={recordStepY('registerDay')}>
                    <FormPicker
                      label={t('customer.registerDay')}
                      value={registerDay}
                      onValueChange={(value) => {
                        setRegisterDay(value);
                        continueIfOpenedByNav('registerDay');
                      }}
                      items={loanDayOptions}
                      placeholder={t('customer.selectRegisterDay')}
                      error={errors.registerDay}
                      editable
                      style={styles.existingPickerCompact}
                      visible={registerDayPickerOpen}
                      onVisibleChange={(open) => {
                        setRegisterDayPickerOpen(open);
                        if (!open && navOpenedRef.current === 'registerDay' && !navContextRef.current.registerDay) {
                          navOpenedRef.current = null;
                        }
                      }}
                      required
                    />
                  </View>
                )}
              </View>

              <View onLayout={recordStepY('search')}>
              <Text style={styles.existingSearchLabel}>
                {t('customer.searchCustomer')}
                <Text style={styles.labelRequiredMark}> *</Text>
              </Text>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search" size={20} color={COLORS.text.tertiary} style={styles.searchIcon} />
                <TextInput
                  ref={existingSearchRef}
                  style={styles.searchInput}
                  placeholder={language === 'en' ? 'Enter phone number to search' : t('customer.enterPhoneToSearch')}
                  placeholderTextColor={COLORS.text.tertiary}
                  value={existingSearch}
                  onChangeText={setExistingSearch}
                  onFocus={ensureCheckedInForInteraction}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  blurOnSubmit={false}
                />
                {searchLoading && <ActivityIndicator size="small" color={COLORS.primary} style={styles.searchLoader} />}
              </View>
              {searchError && <Text style={styles.searchErrorText}>{searchError}</Text>}
              </View>

              {searchResults.length > 0 &&
                !searchLoading &&
                searchResults.map((item, index) => (
                  <TouchableOpacity
                    key={item.id ?? item.customer_no ?? index}
                    style={String(item.id) === String(searchedCustomerId) ? styles.existingResultCardActive : styles.existingResultCard}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSearchedCustomerId(item.id);
                      const hasOpenLoansForCustomer = Array.isArray(item.open_loans) && item.open_loans.length > 0;
                      resetExistingLoanEntryFields();
                      setShowExistingLoanForm(!hasOpenLoansForCustomer);
                    }}
                  >

                    <Text style={styles.existingResultName}>
                      {item.customer_name ?? '—'}
                    </Text>

                    <Text style={styles.existingResultMeta}>
                      {t('customer.no')} {item.customer_no ?? '—'} ·{' '}
                      {item.customer_phone ?? '—'}
                    </Text>

                    {item.customer_address ? (
                      <Text
                        style={styles.existingResultAddress}
                        numberOfLines={2}
                      >
                        {item.customer_address}
                      </Text>
                    ) : null}

                    {Array.isArray(item.open_loans) && item.open_loans.length > 0 ? (
                      <View style={styles.openLoansBadge}>
                        <Ionicons
                          name="information-circle"
                          size={20}
                          color={COLORS.warning}
                        />
                        <Text style={styles.openLoansText}>
                          {t('customer.customerHasOpenLoans')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.canSubmitBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={COLORS.success}
                        />
                        <Text style={styles.canSubmitText}>
                          {t('customer.noOpenLoansCanSubmit')}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

              {customerType === 'Existing' && canSubmitLoanForExisting && showExistingLoanForm && (
                <View style={styles.existingLoanForm}>
                  <View onLayout={recordStepY('loanAmount')}>
                    <Input
                      ref={loanAmountRef}
                      label={t('customer.loanAmount')}
                      value={loanAmount}
                      onChangeText={(text) => {
                        setLoanAmount(text);
                        if (errors.loanAmount) setErrors((prev) => ({ ...prev, loanAmount: null }));
                      }}
                      onFocus={ensureCheckedInForInteraction}
                      placeholder={language === 'en' ? 'Enter amount' : 'தொகையை உள்ளிடவும்'}
                      keyboardType="numeric"
                      error={errors.loanAmount}
                      required
                      returnKeyType="next"
                      blurOnSubmit={false}
                      submitBehavior="submit"
                      onSubmitEditing={() => goToNextFrom('loanAmount')}
                    />
                  </View>

                  <View onLayout={recordStepY('magimai')}>
                    <Input
                      ref={magimaiRef}
                      label={t('loan.processingFees') || 'Processing fees'}
                      value={magimaiAmount}
                      onChangeText={(text) => {
                        setMagimaiAmount(text);
                        if (errors.magimaiAmount) setErrors((prev) => ({ ...prev, magimaiAmount: null }));
                      }}
                      onFocus={ensureCheckedInForInteraction}
                      placeholder={language === 'en' ? 'Enter amount' : 'தொகையை உள்ளிடவும்'}
                      keyboardType="decimal-pad"
                      error={errors.magimaiAmount}
                      required
                      returnKeyType="next"
                      blurOnSubmit={false}
                      submitBehavior="submit"
                      onSubmitEditing={() => goToNextFrom('magimai')}
                    />
                  </View>

                  <View onLayout={recordStepY('aathayam')}>
                    <Input
                      ref={aathayamRef}
                      label={t('loan.interestAmount') || 'Interest amount'}
                      value={aathayamAmount}
                      onChangeText={(text) => {
                        setAathayamAmount(text);
                        if (errors.aathayamAmount) setErrors((prev) => ({ ...prev, aathayamAmount: null }));
                      }}
                      onFocus={ensureCheckedInForInteraction}
                      placeholder={language === 'en' ? 'Enter amount' : 'தொகையை உள்ளிடவும்'}
                      keyboardType="decimal-pad"
                      error={errors.aathayamAmount}
                      required
                      returnKeyType="next"
                      blurOnSubmit={false}
                      submitBehavior="submit"
                      onSubmitEditing={() => goToNextFrom('aathayam')}
                    />
                  </View>

                  <View onLayout={recordStepY('customerPhoto')}>
                    {renderImageSection(t('customer.customerPhoto'), customerPhoto, 'customer', 'customerPhoto', true)}
                  </View>
                  <View onLayout={recordStepY('addressProof')}>
                    {renderImageSection(t('customer.addressProof'), addressProof, 'address', 'addressProof', true)}
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed button bar outside KeyboardAvoidingView so it never moves */}
      {customerType === 'New' && (
        <View style={[styles.fixedBottomContainer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 56 : 20) }]}>
          <Button
            title={t('customer.createCustomer')}
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
      )}
      {customerType === 'Existing' && (
        <View style={[styles.fixedBottomContainer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 56 : 20) }]}>
          <Button
            title={t('loan.createLoan')}
            onPress={handleSubmit}
            loading={loading}
            disabled={!canSubmitLoanForExisting || !showExistingLoanForm}
            style={styles.submitButton}
          />
        </View>
      )}
      <ImagePreviewModal
        visible={!!previewImage}
        uri={previewImage?.uri ?? null}
        title={previewImage?.title ?? ''}
        onClose={() => setPreviewImage(null)}
      />

      <Modal
        visible={showAddCityModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCloseAddCity}
      >
        <KeyboardAvoidingView
          style={styles.addCityOverlay}
          behavior="padding"
        >
          <Pressable style={styles.addCityBackdrop} onPress={handleCloseAddCity} />
          <View style={styles.addCityCard}>
            <Text style={styles.addCityTitle}>{t('customer.addCity')}</Text>
            <TextInput
              ref={addCityInputRef}
              style={styles.addCityInput}
              value={newCityName}
              onChangeText={(text) => {
                setNewCityName(text);
                if (addCityError) setAddCityError('');
              }}
              placeholder={t('customer.enterCityName')}
              placeholderTextColor={COLORS.text.tertiary}
              showSoftInputOnFocus
              blurOnSubmit={false}
              onSubmitEditing={handleAddCity}
            />
            {addCityError ? <Text style={styles.addCityError}>{addCityError}</Text> : null}
            <View style={styles.addCityActions}>
              <TouchableOpacity
                style={styles.addCityCancelBtn}
                onPress={handleCloseAddCity}
                disabled={addingCity}
              >
                <Text style={styles.addCityCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addCitySaveBtn, addingCity && styles.addCitySaveBtnDisabled]}
                onPress={handleAddCity}
                disabled={addingCity}
              >
                {addingCity ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.addCitySaveText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.padding * 1.5,
  },
  radioOptionActive: {},
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: COLORS.primary,
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  radioLabel: {
    fontSize: SIZES.body2,
    color: COLORS.primary,
    marginLeft: SIZES.base,
  },
  radioLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  existingSection: {
    padding: SIZES.padding,
  },
  existingPickerGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SIZES.base,
    marginBottom: SIZES.padding,
  },
  existingPickerGridItem: {
    flex: 1,
    minWidth: 0,
  },
  existingPickerCompact: {
    marginBottom: 0,
  },
  existingSearchLabel: {
    fontSize: SIZES.body2, // Increased font size for label
    fontWeight: '600', // Added font weight for emphasis
    color: COLORS.primary,
    marginBottom: SIZES.base,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.base,
  },
  searchIcon: {
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SIZES.padding,
    fontSize: SIZES.body4, // Reduced font size for placeholder
    color: COLORS.black,
  },
  searchLoader: {
    marginLeft: SIZES.base,
  },
  searchErrorText: {
    fontSize: SIZES.body3,
    color: COLORS.error,
    marginBottom: SIZES.base,
  },
  existingResultCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  existingResultCardActive: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  existingResultName: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  existingResultMeta: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 2,
  },
  existingResultAddress: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    marginBottom: SIZES.base,
  },
  existingLoanForm: {
    marginTop: SIZES.padding,
  },
  openLoansBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,193,7,0.15)',
    padding: SIZES.base,
    borderRadius: SIZES.radius,
  },
  openLoansText: {
    flex: 1,
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginLeft: SIZES.base,
  },
  canSubmitBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(40,167,69,0.15)',
    padding: SIZES.base,
    borderRadius: SIZES.radius,
  },
  canSubmitText: {
    flex: 1,
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginLeft: SIZES.base,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: 120,
  },
  imageSection: {
    marginBottom: SIZES.margin,
  },
  imageLabel: {
    fontSize: SIZES.body2,
    fontWeight: '500',
    color: COLORS.primary,
    marginBottom: SIZES.base / 2,
  },
  imageLabelRequired: {
    color: COLORS.error,
    fontWeight: '600',
  },
  labelRequiredMark: {
    color: COLORS.error,
    fontWeight: '600',
  },
  imagePreview: {
    position: 'relative',
    width: '100%',
    height: 120,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  previewHint: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewHintText: {
    color: COLORS.white,
    fontSize: 10,
    marginLeft: 2,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  imageOptionsWrap: {
    position: 'relative',
    minHeight: 120,
    justifyContent: 'center',
  },
  imageOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageOptionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
    marginHorizontal: SIZES.base / 2,
  },
  imageOptionText: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginTop: SIZES.base / 2,
    fontWeight: '500',
  },
  errorText: {
    color: COLORS.error,
    fontSize: SIZES.body4,
    marginTop: SIZES.base / 2,
  },
  fixedBottomContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitButton: {
    minHeight: 52,
  },
  addCityOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  addCityBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  addCityCard: {
    width: '88%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    padding: SIZES.padding,
    zIndex: 1,
  },
  addCityTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: SIZES.padding,
  },
  addCityInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    fontSize: SIZES.body2,
    color: COLORS.black,
    marginBottom: SIZES.padding,
  },
  addCityError: {
    color: COLORS.error,
    fontSize: SIZES.body4,
    marginTop: -SIZES.base,
    marginBottom: SIZES.padding,
  },
  addCityActions: {
    flexDirection: 'row',
    gap: SIZES.base,
  },
  addCityCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
  },
  addCityCancelText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  addCitySaveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.primary,
  },
  addCitySaveBtnDisabled: {
    opacity: 0.7,
  },
  addCitySaveText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default CustomerWithLoanScreen;

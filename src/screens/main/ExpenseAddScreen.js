import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import DatePicker from '../../components/common/DatePicker';
import FormInput from '../../components/common/FormInput';
import FormPicker from '../../components/common/FormPicker';
import Header from '../../components/common/Header';
import CustomImagePicker from '../../components/common/ImagePicker';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError, showSuccess } from '../../utils/alertService';
import { formatDateForAPI, getCalendarDate, getCalendarDateISO } from '../../utils/dateFormatter';
import { safeGoBack } from '../../utils/navigationHelpers';

const EXPENSE_DATE_WINDOW_DAYS = 6; // today + previous 6 days = 1 week

const getExpenseDateBounds = () => {
  const today = getCalendarDate();
  const minimumDate = new Date(today);
  minimumDate.setDate(minimumDate.getDate() - EXPENSE_DATE_WINDOW_DAYS);
  minimumDate.setHours(0, 0, 0, 0);
  const maximumDate = new Date(today);
  maximumDate.setHours(23, 59, 59, 999);
  return { minimumDate, maximumDate };
};

const isExpenseDateInAllowedRange = (dateValue) => {
  if (!dateValue) return false;
  const selected = formatDateForAPI(dateValue);
  if (!selected) return false;
  const { minimumDate, maximumDate } = getExpenseDateBounds();
  const minStr = formatDateForAPI(minimumDate);
  const maxStr = formatDateForAPI(maximumDate);
  return selected >= minStr && selected <= maxStr;
};

const initialFormState = {
  category: '',
  amount: '',
  date: getCalendarDateISO(),
  description: '',
  lineuser: '',
};

const toBranchUserPickerItems = (users) =>
  (Array.isArray(users) ? users : []).map((user) => {
    const name = typeof user?.name === 'string' ? user.name.trim() : '';
    const lines = (user?.lines || [])
      .map((l) => (typeof l?.line_name === 'string' ? l.line_name.trim() : ''))
      .filter(Boolean)
      .join(', ');
    const label = lines ? (name ? `${name} — ${lines}` : lines) : name || String(user?.id ?? '');
    return { label, value: String(user.id) };
  });

const FORM_STEPS = ['category', 'lineuser', 'amount', 'date', 'description', 'image'];

const ExpenseAddScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState(initialFormState);

  const [selectedImage, setSelectedImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [branchUserOptions, setBranchUserOptions] = useState([]);
  const [branchUsersLoading, setBranchUsersLoading] = useState(false);
  const branchUsersFetchRef = useRef(null);
  const scrollViewRef = useRef(null);
  const stepYRef = useRef({});
  const formDataRef = useRef(formData);
  const selectedImageRef = useRef(selectedImage);
  const navOpenedRef = useRef(null);
  const amountRef = useRef(null);
  const descriptionRef = useRef(null);
  const imagePickerRef = useRef(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [lineUserPickerOpen, setLineUserPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { minimumDate: expenseMinDate, maximumDate: expenseMaxDate } = getExpenseDateBounds();

  formDataRef.current = formData;
  selectedImageRef.current = selectedImage;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCategoriesLoading(true);
      try {
        const list = await apiServices.expenseCategory.getActiveList();
        if (!cancelled) {
          setCategoryOptions(
            (list || []).map((item) => ({
              label: item.category || String(item.id),
              value: String(item.id),
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setCategoryOptions([]);
        console.warn('Failed to load expense categories:', err);
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadBranchUsers = async () => {
    if (branchUsersFetchRef.current) return branchUsersFetchRef.current;

    const fetchPromise = (async () => {
      setBranchUsersLoading(true);
      try {
        const users = await apiServices.branchUsers.getList();
        setBranchUserOptions(toBranchUserPickerItems(users));
      } catch (err) {
        setBranchUserOptions([]);
        showError(t('common.error'), getApiErrorMessage(err, t('expenses.failedToLoadBranchUsers')));
      } finally {
        setBranchUsersLoading(false);
        branchUsersFetchRef.current = null;
      }
    })();

    branchUsersFetchRef.current = fetchPromise;
    return fetchPromise;
  };

  const recordStepY = (step) => (event) => {
    stepYRef.current[step] = event.nativeEvent.layout.y;
  };

  const scrollToStep = (step) => {
    const y = stepYRef.current[step];
    if (y == null) return;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  const goToStep = (step) => {
    const data = formDataRef.current;
    scrollToStep(step);

    switch (step) {
      case 'category': {
        if (data.category) {
          goToStep('lineuser');
          return;
        }
        Keyboard.dismiss();
        navOpenedRef.current = 'category';
        setCategoryPickerOpen(true);
        return;
      }
      case 'lineuser': {
        if (data.lineuser) {
          goToStep('amount');
          return;
        }
        Keyboard.dismiss();
        navOpenedRef.current = 'lineuser';
        loadBranchUsers();
        setLineUserPickerOpen(true);
        return;
      }
      case 'amount': {
        setTimeout(() => amountRef.current?.focus(), 350);
        return;
      }
      case 'date': {
        if (data.date && isExpenseDateInAllowedRange(data.date)) {
          goToStep('description');
          return;
        }
        Keyboard.dismiss();
        navOpenedRef.current = 'date';
        setDatePickerOpen(true);
        return;
      }
      case 'description': {
        setTimeout(() => descriptionRef.current?.focus(), 80);
        return;
      }
      case 'image': {
        Keyboard.dismiss();
        setTimeout(() => {
          scrollToStep('image');
          if (!selectedImageRef.current) {
            navOpenedRef.current = 'image';
            imagePickerRef.current?.openCamera?.();
          }
        }, 250);
        return;
      }
      default:
        return;
    }
  };

  const goToNextFrom = (step) => {
    const index = FORM_STEPS.indexOf(step);
    if (index < 0 || index >= FORM_STEPS.length - 1) return;
    goToStep(FORM_STEPS[index + 1]);
  };

  const continueIfOpenedByNav = (step, nextStep) => {
    if (navOpenedRef.current !== step) return;
    navOpenedRef.current = null;
    setTimeout(() => goToStep(nextStep), 300);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.category) newErrors.category = t('expenses.typeRequired');
    if (!formData.amount) {
      newErrors.amount = t('expenses.amountRequired');
    } else if (parseFloat(formData.amount) <= 0) {
      newErrors.amount = t('validation.invalidAmount');
    }
    if (!formData.date) {
      newErrors.date = t('expenses.dateRequired');
    } else if (!isExpenseDateInAllowedRange(formData.date)) {
      newErrors.date = t('expenses.dateWithinOneWeek');
    }
    if (!selectedImage) newErrors.image = t('customer.imageRequired');

    setErrors(newErrors);
    return newErrors;
  };

  const focusFirstInvalidField = (newErrors) => {
    if (newErrors.category) {
      goToStep('category');
      return;
    }
    if (newErrors.amount) {
      goToStep('amount');
      return;
    }
    if (newErrors.date) {
      goToStep('date');
      return;
    }
    if (newErrors.image) {
      goToStep('image');
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      focusFirstInvalidField(newErrors);
      return;
    }

    const selectedCategoryLabel = categoryOptions.find((opt) => opt.value === formData.category)?.label || formData.category || 'Expense';
    const title = `${selectedCategoryLabel} Expense`;

    setSubmitting(true);
    try {
      const expensePayload = {
        title,
        category: formData.category,
        amount: formData.amount,
        date: formatExpenseDate(formData.date),
        description: formData.description || '',
        receiptImageUri: selectedImage?.uri ?? selectedImage ?? null,
        lineuser: formData.lineuser || null,
      };
      console.log('💰 expense.submit - payload:', JSON.stringify(expensePayload, null, 2));

      const response = await apiServices.expense.create({
        title,
        category: formData.category,
        amount: formData.amount,
        date: formatExpenseDate(formData.date),
        description: formData.description || '',
        receiptImageUri: selectedImage,
        lineuser: formData.lineuser,
      });

      const success = response?.success !== false && (response?.status !== 400 && response?.status !== 500);
      const message = response?.message || t('success.saved');

      if (success) {
        setFormData(initialFormState);
        setSelectedImage(null);
        setErrors({});
        showSuccess(t('common.success'), message, [
          { text: t('common.ok'), onPress: () => safeGoBack(navigation) },
        ]);
      } else {
        showError(t('common.error'), response?.message || message || t('errors.somethingWentWrong'));
      }
    } catch (error) {
      showError(t('common.error'), getApiErrorMessage(error, t('errors.somethingWentWrong')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // API expects date as "YYYY-MM-DD HH:mm" (e.g. "2026-03-12 10:30")
  const formatExpenseDate = (dateValue) => {
    if (!dateValue) return '';
    const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('expenses.addExpense')}
        showBackButton={true}
        onBackPress={() => safeGoBack(navigation)}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          <View onLayout={recordStepY('category')}>
            <FormPicker
              label={t('expenses.expenseType')}
              value={formData.category}
              onValueChange={(value) => {
                handleInputChange('category', value);
                continueIfOpenedByNav('category', 'lineuser');
              }}
              items={categoryOptions}
              placeholder={categoriesLoading ? t('common.loading') || 'Loading...' : t('expenses.expenseType')}
              error={errors.category}
              required
              fullScreenModal
              searchable
              modalTitle={t('expenses.selectExpenseType')}
              searchPlaceholder={t('expenses.searchExpenseType')}
              noResultsText={t('expenses.noExpenseTypeMatches')}
              loading={categoriesLoading}
              loadingText={t('common.loading') || 'Loading...'}
              visible={categoryPickerOpen}
              onVisibleChange={(open) => {
                setCategoryPickerOpen(open);
                if (!open && navOpenedRef.current === 'category' && !formDataRef.current.category) {
                  navOpenedRef.current = null;
                }
              }}
            />
          </View>

          <View onLayout={recordStepY('lineuser')}>
            <FormPicker
              label={t('expenses.lineUser')}
              value={formData.lineuser}
              onValueChange={(value) => {
                handleInputChange('lineuser', value);
                continueIfOpenedByNav('lineuser', 'amount');
              }}
              items={branchUserOptions}
              placeholder={
                branchUsersLoading
                  ? t('common.loading') || 'Loading...'
                  : t('expenses.selectLineUser')
              }
              error={errors.lineuser}
              fullScreenModal
              searchable
              modalTitle={t('expenses.selectLineUser')}
              searchPlaceholder={t('expenses.searchLineUser')}
              noResultsText={t('expenses.noLineUserMatches')}
              onOpen={loadBranchUsers}
              loading={branchUsersLoading}
              loadingText={t('common.loading') || 'Loading...'}
              visible={lineUserPickerOpen}
              onVisibleChange={(open) => {
                setLineUserPickerOpen(open);
                if (!open && navOpenedRef.current === 'lineuser' && !formDataRef.current.lineuser) {
                  navOpenedRef.current = null;
                }
              }}
            />
          </View>

          <View onLayout={recordStepY('amount')}>
            <FormInput
              ref={amountRef}
              label={t('expenses.expenseAmount')}
              value={formData.amount}
              onChangeText={(value) => handleInputChange('amount', value)}
              placeholder="0.00"
              keyboardType="numeric"
              error={errors.amount}
              required
              returnKeyType="next"
              blurOnSubmit={false}
              submitBehavior="submit"
              onSubmitEditing={() => goToNextFrom('amount')}
            />
          </View>

          <View onLayout={recordStepY('date')}>
            <DatePicker
              label={t('expenses.expenseDate')}
              value={formData.date}
              onValueChange={(value) => {
                handleInputChange('date', value);
                continueIfOpenedByNav('date', 'description');
              }}
              error={errors.date}
              minimumDate={expenseMinDate}
              maximumDate={expenseMaxDate}
              required
              visible={datePickerOpen}
              onVisibleChange={(open) => {
                setDatePickerOpen(open);
                if (!open && navOpenedRef.current === 'date' && !formDataRef.current.date) {
                  navOpenedRef.current = null;
                }
              }}
            />
          </View>

          <View onLayout={recordStepY('description')}>
            <FormInput
              ref={descriptionRef}
              label={t('expenses.description')}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder={t('expenses.description')}
              multiline
              numberOfLines={4}
              returnKeyType="next"
              blurOnSubmit
              submitBehavior="submit"
              onSubmitEditing={() => goToNextFrom('description')}
            />
          </View>

          <View onLayout={recordStepY('image')}>
            <CustomImagePicker
              ref={imagePickerRef}
              label={t('expenses.receiptImage')}
              image={selectedImage}
              onImageChange={(img) => {
                setSelectedImage(img);
                if (errors.image) setErrors((prev) => ({ ...prev, image: '' }));
                if (navOpenedRef.current === 'image') {
                  navOpenedRef.current = null;
                }
              }}
              error={errors.image}
              required
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 56 : 20) }]}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={COLORS.white} style={{ marginRight: SIZES.base }} />
          <Text style={styles.submitButtonText}>
            {submitting ? (t('common.loading') || 'Submitting...') : t('common.submit')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 4,
  },
  bottomSection: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    // paddingBottom set inline so Submit stays above system nav bar (insets.bottom often 0 on Android)
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ExpenseAddScreen;

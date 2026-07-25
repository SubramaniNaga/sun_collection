import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { showError, showSuccess } from '../../utils/alertService';
import { guardAttendanceGatedEntry } from '../../utils/attendanceEntryGate';
import { safeGoBack } from '../../utils/navigationHelpers';
import { formatCurrency } from '../../utils/amountFormatters';
import { formatDisplayDate } from '../../utils/dateFormatter';

const API_BASE_URL = 'http://65.0.100.65:6005';

/** Android edge-to-edge often reports 0 bottom inset — reserve space for 3-button nav bar */
const ANDROID_NAV_BAR_HEIGHT = 56;

const getBottomInset = (insets) => (
  Platform.OS === 'android'
    ? Math.max(insets.bottom, ANDROID_NAV_BAR_HEIGHT)
    : Math.max(insets.bottom, SIZES.base)
);

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/api')) return `${API_BASE_URL}${imagePath}`;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}/api/v1${cleanPath}`;
};

const NIPCollectionDetailsScreen = ({ navigation, route }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomInset = getBottomInset(insets);
  const submitBarReservedHeight = 52 + SIZES.padding + bottomInset + SIZES.base;
  const { loan } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoModalUri, setPhotoModalUri] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nip_date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
    amount_paid: '',
    balance_amount: loan?.balanceAmount || '0',
    notes: '',
    payment_type: 'cash', // Default to cash
  });

  useEffect(() => {
    // Loan from NIPScreen includes loanTypeName / loan_type_name from API when NIPLoan model maps it
  }, [loan]);

  const paymentTypes = [
    { key: 'cash', label: t('nip.cash'), icon: 'cash-outline' },
    { key: 'online', label: t('nip.online'), icon: 'globe-outline' },
  ];

  useEffect(() => {
    // Set initial balance amount from loan data
    if (loan?.balanceAmount) {
      setFormData(prev => ({
        ...prev,
        balance_amount: loan.balanceAmount
      }));
    }
  }, [loan]);

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);

      // Request location permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('nip.permissionDenied'), t('nip.locationPermissionDenied'));
        return null;
      }

      // Get current location
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      setCurrentLocation({ latitude, longitude });

      console.log('Current location captured:', { latitude, longitude });
      return { latitude, longitude };
    } catch (error) {
      showError('Location Error', 'Failed to capture current location. Please try again.');
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePaymentTypeSelect = (type) => {
    setFormData(prev => ({
      ...prev,
      payment_type: type
    }));
  };

  const isFormComplete = useMemo(() => {
    const amount = parseFloat(formData.amount_paid);
    return (
      Boolean(formData.nip_date) &&
      !Number.isNaN(amount) &&
      amount > 0 &&
      Boolean(formData.payment_type) &&
      formData.notes.trim().length > 0
    );
  }, [formData]);

  const renderRequiredLabel = (label) => (
    <Text style={styles.formLabel}>
      {label}
      <Text style={styles.requiredMark}> *</Text>
    </Text>
  );

  const validateForm = () => {
    if (!formData.amount_paid || parseFloat(formData.amount_paid) <= 0) {
      showError('Validation Error', 'Please enter a valid amount paid');
      return false;
    }

    if (!formData.notes.trim()) {
      showError('Validation Error', 'Please enter notes for this collection');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!guardAttendanceGatedEntry(t)) return;
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      // Get current location
      const location = await getCurrentLocation();
      if (!location) {
        setSubmitting(false);
        return;
      }

      // Prepare payload
      const payload = {
        loan_id: loan?.id,
        customer_id: loan?.customerId,
        nip_date: formData.nip_date,
        amount_paid: parseFloat(formData.amount_paid),
        balance_amount: parseFloat(formData.balance_amount),
        notes: formData.notes,
        payment_type: formData.payment_type,
        latitude: location.latitude,
        longitude: location.longitude,
        status: 1, // Default status
      };

      console.log('Submitting NIP collection:', payload);

      // Call API
      const response = await apiServices.loan.createNIPCollection(payload);

      if (response.success) {
        showSuccess('Success', 'NIP collection created successfully');
        safeGoBack(navigation);
      } else {
        showError('Error', response.message || 'Failed to create NIP collection');
      }
    } catch (error) {
      showError('Error', 'Failed to create NIP collection. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const openPhotoModal = (imagePath) => {
    const uri = getImageUrl(imagePath);
    if (uri) {
      setPhotoModalUri(uri);
      setPhotoModalVisible(true);
    }
  };

  const renderCustomerInfo = () => (
    <View style={styles.customerInfoCard}>
      <View style={styles.customerHeader}>
        <TouchableOpacity
          style={styles.customerPhotoWrap}
          onPress={() => openPhotoModal(loan?.customerPhoto ?? loan?.customer_photo)}
          activeOpacity={0.8}
        >
          {(loan?.customerPhoto ?? loan?.customer_photo) ? (
            <Image
              source={{ uri: getImageUrl(loan?.customerPhoto ?? loan?.customer_photo) }}
              style={styles.customerPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.customerPhotoPlaceholder}>
              <Ionicons name="person-outline" size={24} color={COLORS.text.tertiary} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.customerDetails}>
          <Text style={styles.customerName}>
            {loan?.customerName ?? loan?.customer_name ?? 'Unknown Customer'}
          </Text>
          <Text style={styles.customerId}>
            ID: {loan?.customerId ?? loan?.customer_no ?? loan?.customer_id ?? '—'}
          </Text>
          {loan?.customerPhone && (
            <Text style={styles.customerPhone}>{loan.customerPhone}</Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderLoanInfo = () => (
    <View style={styles.loanInfoCard}>
      <Text style={styles.cardTitle}>{t('nip.loanDetails')}</Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{t('loan.loanAmount')}</Text>
        <Text style={styles.infoValue}>{formatCurrency(loan?.loanAmount)}</Text>
      </View>

      {loan?.approvedAmount && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('loan.approvedAmount')}</Text>
          <Text style={styles.infoValue}>{formatCurrency(loan?.approvedAmount)}</Text>
        </View>
      )}

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{t('loan.balanceAmount')}</Text>
        <Text style={styles.infoValueAmount}>{formatCurrency(loan?.balanceAmount)}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{t('nip.nipPaidTotal')}</Text>
        <Text style={styles.infoValueAmount}>
          {formatCurrency(loan?.nipPaidTotal ?? loan?.nip_paid_total ?? 0)}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{t('loan.loanPeriod')}</Text>
        <Text style={styles.infoValue}>
          {loan?.loanPeriod ?? loan?.loan_period ?? '—'} {loan?.loanTypeName ?? loan?.loan_type_name ?? t('loan.months')}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{t('loan.branch')}</Text>
        <Text style={styles.infoValue}>{loan?.branchName || loan?.branch || '—'}</Text>
      </View>

      <View style={[styles.infoRow, styles.infoRowLast]}>
        <Text style={styles.infoLabel}>{t('loan.requestedDate')}</Text>
        <Text style={styles.infoValue}>{formatDisplayDate(loan?.requestedDate ?? loan?.requested_date)}</Text>
      </View>
    </View>
  );

  const renderCollectionForm = () => (
    <View style={styles.formCard}>
      <Text style={styles.cardTitle}>{t('nip.collectionDetails')}</Text>

      {/* NIP Date */}
      <View style={styles.formRow}>
        {renderRequiredLabel(t('nip.nipDate'))}
        <View style={styles.dateInput}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.text.tertiary} />
          <Text style={styles.dateText}>{formatDate(formData.nip_date)}</Text>
        </View>
      </View>

      {/* Amount Paid */}
      <View style={styles.formRow}>
        {renderRequiredLabel(t('nip.amountPaid'))}
        <TextInput
          style={styles.textInput}
          placeholder={t('nip.enterAmountPaid')}
          placeholderTextColor={COLORS.text.tertiary}
          value={formData.amount_paid}
          onChangeText={(value) => handleInputChange('amount_paid', value)}
          keyboardType="numeric"
        />
      </View>

      {/* Balance Amount */}
      <View style={styles.formRow}>
        <Text style={styles.formLabel}>{t('nip.balanceAmount')}</Text>
        <View style={styles.balanceInput}>
          <Ionicons name="wallet-outline" size={16} color={COLORS.error} />
          <Text style={styles.balanceText}>{formatCurrency(formData.balance_amount)}</Text>
        </View>
      </View>

      {/* Payment Type */}
      <View style={styles.formRow}>
        {renderRequiredLabel(t('nip.paymentType'))}
        <View style={styles.paymentTypesContainer}>
          {paymentTypes.map((type) => (
            <TouchableOpacity
              key={type.key}
              style={[
                styles.paymentTypeButton,
                formData.payment_type === type.key && styles.paymentTypeButtonSelected,
              ]}
              onPress={() => handlePaymentTypeSelect(type.key)}
            >
              <Ionicons
                name={type.icon}
                size={16}
                color={formData.payment_type === type.key ? COLORS.white : COLORS.text.secondary}
              />
              <Text
                style={[
                  styles.paymentTypeText,
                  formData.payment_type === type.key && styles.paymentTypeTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notes */}
      <View style={styles.formRow}>
        {renderRequiredLabel(t('nip.notes'))}
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          placeholder={t('nip.enterNotes')}
          placeholderTextColor={COLORS.text.tertiary}
          value={formData.notes}
          onChangeText={(value) => handleInputChange('notes', value)}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Location Status */}
      {/* <View style={styles.formRow}>
        <Text style={styles.formLabel}>Location</Text>
        <View style={styles.locationStatus}>
          {currentLocation ? (
            <View style={styles.locationCaptured}>
              <Ionicons name="location-outline" size={16} color={COLORS.success} />
              <Text style={styles.locationText}>Location captured</Text>
            </View>
          ) : (
            <View style={styles.locationPending}>
              <Ionicons name="location-outline" size={16} color={COLORS.text.tertiary} />
              <Text style={styles.locationText}>Will be captured on submit</Text>
            </View>
          )}
        </View>
      </View> */}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor={COLORS.statusBar} />
        <Header
          title={t('nip.collectionTitle')}
          showBackButton={true}
          onBackPress={() => safeGoBack(navigation)}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('nip.loadingLoanDetails')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('nip.collectionTitle')}
        showBackButton={true}
        onBackPress={() => safeGoBack(navigation)}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isFormComplete
              ? { paddingBottom: submitBarReservedHeight }
              : styles.scrollContentNoSubmit,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderCustomerInfo()}
          {renderLoanInfo()}
          {renderCollectionForm()}
        </ScrollView>
      </KeyboardAvoidingView>

      {isFormComplete ? (
        <View style={[styles.fixedBottomContainer, { paddingBottom: bottomInset }]}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
                <Text style={styles.submitButtonText}>{t('nip.submitCollection')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

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
    </View>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  scrollContentNoSubmit: {
    paddingBottom: SIZES.padding,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
  },

  customerInfoCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 1.25,
    marginBottom: SIZES.base * 1.25,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerPhotoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: SIZES.base,
  },
  customerPhoto: {
    width: '100%',
    height: '100%',
  },
  customerPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  customerId: {
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
    marginBottom: 1,
  },
  customerPhone: {
    fontSize: SIZES.body4,
    color: COLORS.primary,
  },
  loanInfoCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 1.25,
    marginBottom: SIZES.base * 1.25,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 1.25,
    marginBottom: SIZES.base * 1.25,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  cardTitle: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: SIZES.base * 1.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoRowLast: {
    marginBottom: 0,
  },
  infoLabel: {
    fontSize: SIZES.body4,
    color: COLORS.text.tertiary,
    flex: 1,
  },
  infoValue: {
    fontSize: SIZES.body4,
    fontWeight: '500',
    color: COLORS.text.secondary,
    flex: 1,
    textAlign: 'right',
  },
  infoValueAmount: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.error,
    flex: 1,
    textAlign: 'right',
  },
  formRow: {
    marginBottom: SIZES.base * 1.25,
  },
  formLabel: {
    fontSize: SIZES.body3,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 6,
  },
  requiredMark: {
    color: COLORS.error,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.25,
    paddingVertical: SIZES.base * 1.25,
    fontSize: SIZES.body3,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  notesInput: {
    height: 80,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.25,
    paddingVertical: SIZES.base * 1.25,
    backgroundColor: COLORS.lightGray,
  },
  dateText: {
    marginLeft: SIZES.base * 0.75,
    fontSize: SIZES.body3,
    color: COLORS.black,
  },
  balanceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.25,
    paddingVertical: SIZES.base * 1.25,
    backgroundColor: COLORS.lightGray,
  },
  balanceText: {
    marginLeft: SIZES.base * 0.75,
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.error,
  },
  paymentTypesContainer: {
    flexDirection: 'row',
    gap: SIZES.base,
  },
  paymentTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.white,
    flex: 1,
    justifyContent: 'center',
  },
  paymentTypeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  paymentTypeText: {
    marginLeft: SIZES.base * 0.5,
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
  },
  paymentTypeTextSelected: {
    color: COLORS.white,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationCaptured: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationPending: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: SIZES.base * 0.5,
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
  },
  fixedBottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    zIndex: 10,
    elevation: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.padding,
    minHeight: 52,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.text.tertiary,
  },
  submitButtonText: {
    marginLeft: SIZES.base * 0.5,
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.white,
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
});

export default NIPCollectionDetailsScreen;

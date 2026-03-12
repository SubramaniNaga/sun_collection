import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { pickFromCamera, pickFromLibrary } from '../../utils/imagePickerHelper';

const formatLoanDate = (dateStr) => {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric'}); }
  catch { return dateStr; }
};

const formatLoanAmount = (val) => {
  if (val == null || val === '') return '—';
  const num = parseFloat(val);
  return isNaN(num) ? String(val) : `₹${num.toLocaleString('en-IN')}`;
};

const getLoanStatusLabel = (loan) => {
  const approval = loan?.approval_status;
  const loanStatus = loan?.loan_status;
  if (approval === '2') return 'Rejected';
  if (loanStatus === '4') return 'Closed';
  if (approval === '0') return 'Pending';
  if (loanStatus === '3') return 'Active';
  if (loanStatus === '2' || approval === '1') return 'Approved';
  return 'Pending';
};

const LoanScreen = ({ navigation, route }) => {
  const { loan, customerData: paramCustomerData } = route.params || {};
  const customerData = paramCustomerData || (loan ? {
    name: loan?.customer_name ?? '',
    phone: loan?.customer_phone ?? '',
    loanId: String(loan?.id ?? ''),
    initialAmount: loan?.loan_amount ?? '',
  } : {});

  // Renewal states
  const [initialLoanAmount, setInitialLoanAmount] = useState(customerData.initialAmount || '');
  const [renewalAmount, setRenewalAmount] = useState(customerData.initialAmount || '');
  const [requestExtraFunds, setRequestExtraFunds] = useState(false);
  const [additionalAmount, setAdditionalAmount] = useState('');

  // KYC states
  const [customerPhoto, setCustomerPhoto] = useState(null);
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharCardImage, setAadharCardImage] = useState(null);

  // Location states (hidden - captured on submit)
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Location capture function (called on submit)
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

      return {
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Location capture error:', error);
      throw error;
    } finally {
      setIsCapturingLocation(false);
    }
  };

  // Handle photo capture
  const handlePhotoCapture = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to take photo');
        return;
      }
      const asset = await pickFromCamera([4, 3]);
      if (asset) setCustomerPhoto(asset);
    } catch (error) {
      console.error('Photo capture error:', error?.message ?? error);
      Alert.alert('Error', error?.message || 'Failed to capture photo. Please try again.');
    }
  };

  // Handle Aadhar card photo capture
  const handleAadharPhotoCapture = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to capture Aadhar card');
        return;
      }
      const asset = await pickFromCamera([3, 2]);
      if (asset) setAadharCardImage(asset);
    } catch (error) {
      console.error('Aadhar capture error:', error?.message ?? error);
      Alert.alert('Error', error?.message || 'Failed to capture Aadhar card photo. Please try again.');
    }
  };

  // Handle Aadhar card upload
  const handleAadharUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Gallery permission is required to select Aadhar card');
        return;
      }
      const asset = await pickFromLibrary([3, 2]);
      if (asset) setAadharCardImage(asset);
    } catch (error) {
      console.error('Aadhar upload error:', error?.message ?? error);
      Alert.alert('Error', error?.message || 'Failed to select Aadhar card. Please try again.');
    }
  };

  // Validation states
  const [errors, setErrors] = useState({});

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!customerPhoto) {
      newErrors.photo = 'Photo is required';
    }

    if (!aadharNumber.trim()) {
      newErrors.aadhar = 'Aadhar number is required';
    } else if (aadharNumber.trim().length !== 12) {
      newErrors.aadhar = 'Aadhar number must be 12 digits';
    }

    if (requestExtraFunds && (!additionalAmount || parseFloat(additionalAmount) <= 0)) {
      newErrors.additionalAmount = 'Additional amount must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if submit button should be enabled
  const isSubmitEnabled = () => {
    return customerPhoto &&
      aadharNumber.trim().length === 12;
  };

  // Handle submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Capture location before submission
      let locationData;
      try {
        locationData = await captureLocation();
      } catch (locationError) {
        Alert.alert('Permission Required', 'Location permission is required for loan renewal. Please enable location access and try again.');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        customerData: {
          name: customerData.name || '',
          loanId: customerData.loanId || '',
          phone: customerData.phone || '',
        },
        initialLoanAmount,
        renewalAmount,
        requestExtraFunds,
        additionalAmount: requestExtraFunds ? additionalAmount : null,
        customerPhoto,
        aadharNumber,
        location: locationData,
      };

      console.log('Loan Renewal Payload:', payload);
      Alert.alert('Success', 'Loan renewal request submitted successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to process loan renewal. Please try again.');
      console.error('Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" backgroundColor={COLORS.primary} />

      <Header
        title="Loan Details"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Complete Loan Details (when opened from list) */}
          {loan && (
            <View style={styles.loanDetailsCard}>
              <Text style={styles.loanDetailsTitle}>Loan Details</Text>
              <View style={[styles.loanDetailsBadge, { backgroundColor: loan?.approval_status === '2' ? COLORS.error : loan?.loan_status === '3' ? COLORS.success : COLORS.primary }]}>
                <Text style={styles.loanDetailsBadgeText}>{getLoanStatusLabel(loan)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loan ID</Text>
                <Text style={styles.detailValue}>#{loan?.id ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Customer</Text>
                <Text style={styles.detailValue}>{loan?.customer_name ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{loan?.customer_phone ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Customer No</Text>
                <Text style={styles.detailValue}>{loan?.customer_no ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Branch</Text>
                <Text style={styles.detailValue}>{loan?.branch ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Line</Text>
                <Text style={styles.detailValue}>{loan?.line_name ?? '—'}</Text>
              </View>

              {/* <Text style={styles.detailSectionTitle}>Amounts</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loan amount</Text>
                <Text style={styles.detailValue}>{formatLoanAmount(loan?.loan_amount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Approved amount</Text>
                <Text style={styles.detailValue}>{formatLoanAmount(loan?.approved_amount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Balance amount</Text>
                <Text style={styles.detailValue}>{formatLoanAmount(loan?.balance_amount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Interest amount</Text>
                <Text style={styles.detailValue}>{formatLoanAmount(loan?.intrest_amount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Processing fees</Text>
                <Text style={styles.detailValue}>{formatLoanAmount(loan?.processing_fees)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment type</Text>
                <Text style={styles.detailValue}>{loan?.payment_type ?? '—'}</Text>
              </View> */}

              {/* <Text style={styles.detailSectionTitle}>Dates & Period</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Requested date</Text>
                <Text style={styles.detailValue}>{formatLoanDate(loan?.requested_date)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Approved date</Text>
                <Text style={styles.detailValue}>{formatLoanDate(loan?.approved_date)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loan period</Text>
                <Text style={styles.detailValue}>{loan?.loan_period != null ? `${loan.loan_period} months` : '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>{formatLoanDate(loan?.created_at)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Updated</Text>
                <Text style={styles.detailValue}>{formatLoanDate(loan?.updated_at)}</Text>
              </View> */}

              {loan?.reject_reason && (
                <>
                  <Text style={styles.detailSectionTitle}>Rejection</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reason</Text>
                    <Text style={[styles.detailValue, { color: COLORS.error }]}>{loan.reject_reason}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rejected date</Text>
                    <Text style={styles.detailValue}>{formatLoanDate(loan?.rejected_date)}</Text>
                  </View>
                </>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
      {/* Fixed Bottom Button */}
      <SafeAreaView style={styles.fixedBottomContainer} edges={['bottom']}>
        <TouchableOpacity
          style={[styles.submitButton, !isSubmitEnabled() && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={!isSubmitEnabled() || isSubmitting}
        >
          {isSubmitting || isCapturingLocation ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.submitButtonText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Process Renewal</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2, // Reduced padding since button is fixed
  },
  loanDetailsCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  loanDetailsTitle: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.text?.primary || COLORS.primary,
    marginBottom: SIZES.margin,
  },
  loanDetailsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base * 0.5,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin,
  },
  loanDetailsBadgeText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.white,
  },
  detailSectionTitle: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text?.secondary || '#333',
    marginTop: SIZES.margin,
    marginBottom: SIZES.base * 0.5,
    paddingTop: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.base * 0.5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text?.tertiary || '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text?.secondary || '#333',
    flex: 1,
    textAlign: 'right',
  },
  detailValueHighlight: {
    fontSize: SIZES.body2,
    fontWeight: '700',
    color: COLORS.primary,
    flex: 1,
    textAlign: 'right',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  cardTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.margin,
  },
  customerInfoCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 0.75,
    marginBottom: SIZES.margin,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  customerInfoHeader: {
    marginBottom: SIZES.margin * 0.5,
  },
  customerInfoTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  customerInfoRow: {
    marginBottom: SIZES.base / 2,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 2,
    textAlign: 'right',
  },
  formRow: {
    marginBottom: SIZES.margin,
  },
  formRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.margin,
  },
  formLabel: {
    fontSize: SIZES.body2,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
    flex: 1,
  },
  formInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    fontSize: SIZES.body3,
    color: COLORS.text.primary,
    backgroundColor: COLORS.white,
    flex: 2,
  },
  readOnlyInput: {
    backgroundColor: COLORS.lightGray,
    color: COLORS.text.secondary,
  },
  toggleButton: {
    width: 48,
    height: 24,
    backgroundColor: COLORS.border,
    borderRadius: 12,
    padding: 2,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleDot: {
    width: 20,
    height: 20,
    backgroundColor: COLORS.white,
    borderRadius: 10,
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  inputError: {
    borderColor: 'red',
  },
  photoSection: {
    alignItems: 'center',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: SIZES.margin,
  },
  photoPreview: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: SIZES.radius,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightGray,
  },
  photoPlaceholderText: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    marginTop: SIZES.base,
  },
  requiredBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    marginTop: SIZES.base,
  },
  requiredText: {
    color: COLORS.white,
    fontSize: SIZES.body3,
    fontWeight: '600',
  },
  aadharImageContainer: {
    flex: 2,
  },
  aadharPreview: {
    position: 'relative',
    width: '100%',
    height: 120,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  aadharImage: {
    width: '100%',
    height: '100%',
  },
  removeAadharButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aadharPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: SIZES.radius,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightGray,
  },
  aadharPlaceholderText: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    marginTop: SIZES.base,
  },
  aadharOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  aadharOptionButton: {
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
  aadharOptionText: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginTop: SIZES.base / 2,
    fontWeight: '500',
  },
  aadharContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
  },
  aadharInput: {
    flex: 1,
  },
  uploadButton: {
    padding: SIZES.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedBottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.25,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? SIZES.padding : SIZES.padding * 0.1, // Safe area padding
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    backgroundColor: '#0536a3', // Updated to match requirement
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.text.tertiary,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body1,
    fontWeight: '600',
  },
});

export default LoanScreen;

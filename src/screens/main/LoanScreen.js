import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { pickFromCamera, pickFromLibrary } from '../../utils/imagePickerHelper';

const API_BASE_URL = 'http://65.0.100.65:6005';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

const LoanScreen = ({ navigation, route }) => {
  const { t } = useLanguage();
  
  const getLoanStatusLabel = (loan) => {
    const approval = loan?.approval_status;
    const loanStatus = loan?.loan_status;
    if (approval === '2') return t('loan.rejected');
    if (loanStatus === '4') return t('loan.closed');
    if (approval === '0') return t('loan.pending');
    if (loanStatus === '3') return t('loan.active');
    if (loanStatus === '2' || approval === '1') return t('loan.approved');
    return t('loan.pending');
  };
  const { loan, customerData: paramCustomerData } = route.params || {};
  const customerData = paramCustomerData || (loan ? {
    name: loan?.customer_name ?? '',
    phone: loan?.customer_phone ?? '',
    loanId: String(loan?.id ?? ''),
    initialAmount: loan?.loan_amount ?? '',
  } : {});

  // Approved loan-given flow (when loan is approved)
  const isLoanApproved = Boolean(
    loan &&
    loan.approval_status !== '2' &&
    loan.loan_status !== '4' &&
    (loan.approval_status === '1' || loan.loan_status === '2')
  );
  const [paymentType, setPaymentType] = useState('cash');
  const [loanGivenPhoto, setLoanGivenPhoto] = useState(null);

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

  // Image viewer states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

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
        Alert.alert(t('common.error'), t('customer.cameraPermissionRequired'));
        return;
      }
      const asset = await pickFromCamera([4, 3]);
      if (asset) setCustomerPhoto(asset);
    } catch (error) {
      console.error('Photo capture error:', error?.message ?? error);
      Alert.alert(t('common.error'), error?.message || t('customer.failedToPickImage', { source: t('common.capture') }));
    }
  };

  // Handle Aadhar card photo capture
  const handleAadharPhotoCapture = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('common.error'), t('customer.cameraPermissionRequired'));
        return;
      }
      const asset = await pickFromCamera([3, 2]);
      if (asset) setAadharCardImage(asset);
    } catch (error) {
      console.error('Aadhar capture error:', error?.message ?? error);
      Alert.alert(t('common.error'), error?.message || t('customer.failedToPickImage', { source: t('common.capture') }));
    }
  };

  // Handle Aadhar card upload
  const handleAadharUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('common.error'), t('customer.galleryPermissionRequired'));
        return;
      }
      const asset = await pickFromLibrary([3, 2]);
      if (asset) setAadharCardImage(asset);
    } catch (error) {
      console.error('Aadhar upload error:', error?.message ?? error);
      Alert.alert(t('common.error'), error?.message || t('customer.failedToPickImage', { source: t('common.pick') }));
    }
  };

  // Loan given photo (approved flow)
  const handleLoanGivenPhotoCapture = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('common.error'), t('customer.cameraPermissionRequired'));
        return;
      }
      const asset = await pickFromCamera([4, 3]);
      if (asset) setLoanGivenPhoto(asset);
    } catch (error) {
      console.error('Loan given photo capture error:', error?.message ?? error);
      Alert.alert(t('common.error'), error?.message || t('customer.failedToPickImage', { source: t('common.capture') }));
    }
  };

  const handleLoanGivenPhotoUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('common.error'), t('customer.galleryPermissionRequired'));
        return;
      }
      const asset = await pickFromLibrary([4, 3]);
      if (asset) setLoanGivenPhoto(asset);
    } catch (error) {
      console.error('Loan given photo upload error:', error?.message ?? error);
      Alert.alert(t('common.error'), error?.message || t('customer.failedToPickImage', { source: t('common.pick') }));
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
    if (loan && isLoanApproved) {
      return paymentType.trim().length > 0 && loanGivenPhoto != null;
    }
    return customerPhoto &&
      aadharNumber.trim().length === 12;
  };

  // Get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // If it starts with /api, it's already a full path
    if (imagePath.startsWith('/api')) {
      return `${API_BASE_URL}${imagePath}`;
    }
    // Otherwise, construct full URL (assuming images are in /api/v1/uploads or similar)
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${API_BASE_URL}/api/v1${cleanPath}`;
  };

  // Handle image icon press
  const handleImagePress = (imagePath, title) => {
    const fullUrl = getImageUrl(imagePath);
    console.log('Full URL:', fullUrl);
    if (fullUrl) {
      setSelectedImage({ uri: fullUrl, title });
      setImageViewerVisible(true);
    } else {
      Alert.alert(t('common.error'), t('customer.imageNotAvailable', { title }));
    }
  };

  // Close image viewer
  const closeImageViewer = () => {
    setImageViewerVisible(false);
    setSelectedImage(null);
  };

  // Handle map press for location
  const handleMapPress = (latitude, longitude, title) => {
    if (!latitude || !longitude) {
      Alert.alert(t('common.error'), t('collection.map'));
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert(t('common.error'), t('collection.map'));
      return;
    }

    // Try Google Maps app first, fallback to web
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const googleMapsAppUrl = `comgooglemaps://?q=${lat},${lng}&center=${lat},${lng}`;
    
    Linking.canOpenURL(googleMapsAppUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(googleMapsAppUrl);
        } else {
          return Linking.openURL(googleMapsUrl);
        }
      })
      .catch((err) => {
        console.error('Error opening Google Maps:', err);
        Linking.openURL(googleMapsUrl).catch((fallbackErr) => {
          console.error('Error opening Google Maps web:', fallbackErr);
          Alert.alert(t('common.error'), t('collection.couldNotOpenGoogleMaps'));
        });
      });
  };

  // Handle submission (approved: PUT loan given with lat/long; else renewal flow)
  const handleSubmit = async () => {
    if (loan && isLoanApproved) {
      if (!paymentType.trim() || !loanGivenPhoto) {
        Alert.alert(t('common.error'), t('loan.paymentTypeAndPhotoRequired') || 'Payment type and loan given photo are required.');
        return;
      }
      setIsSubmitting(true);
      try {
        let locationData;
        try {
          locationData = await captureLocation();
        } catch (locationError) {
          Alert.alert(t('common.error'), t('customer.locationRequired'));
          setIsSubmitting(false);
          return;
        }
        const loanId = loan.id;
        const photoUri = loanGivenPhoto.uri || loanGivenPhoto.localUri;
        const fileName = loanGivenPhoto.fileName || photoUri?.split?.('/').pop() || 'loan_given_photo.png';
        const mimeType = loanGivenPhoto.mimeType || 'image/png';

        const payloadPaymentType = paymentType.trim();
        const payloadLatitude = String(locationData.latitude ?? '');
        const payloadLongitude = String(locationData.longitude ?? '');

        console.log('━━━━━━━━━━━━━━━━━━━━ [Loan Given] PAYLOAD ━━━━━━━━━━━━━━━━━━━━');
        console.log('[Loan Given] loanId:', loanId);
        console.log('[Loan Given] payment_type:', payloadPaymentType);
        console.log('[Loan Given] latitude:', payloadLatitude);
        console.log('[Loan Given] longitude:', payloadLongitude);
        console.log('[Loan Given] loan_given_photo (file):', {
          uri: photoUri || '(null)',
          name: fileName,
          type: mimeType,
          sentAs: 'binary (multipart/form-data file part)',
        });
        console.log('[Loan Given] loanGivenPhoto raw keys:', loanGivenPhoto ? Object.keys(loanGivenPhoto) : []);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const formData = new FormData();
        formData.append('payment_type', payloadPaymentType);
        formData.append('latitude', payloadLatitude);
        formData.append('longitude', payloadLongitude);
        formData.append('loan_given_photo', {
          uri: photoUri,
          name: fileName,
          type: mimeType,
        });

        console.log('[Loan Given] Calling updateLoanGiven, loanId:', loanId);
        await apiServices.loan.updateLoanGiven(loanId, formData);
        Alert.alert(
          t('common.success'),
          t('loan.loanGivenUpdated') || 'Loan given updated successfully.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } catch (error) {
        Alert.alert(t('common.error'), error?.response?.data?.message || error?.message || t('loan.failedToProcessRenewal'));
        console.error('Update loan given error:', error);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let locationData;
      try {
        locationData = await captureLocation();
      } catch (locationError) {
        Alert.alert(t('common.error'), t('customer.locationRequired'));
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
      Alert.alert(t('common.success'), t('loan.renewalSubmitted'));
    } catch (error) {
      Alert.alert(t('common.error'), t('loan.failedToProcessRenewal'));
      console.error('Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('loan.loanDetails')}
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
              <View style={styles.detailRow}>
              <Text style={styles.loanDetailsTitle}>{t('loan.loanDetails')}</Text>
              <View style={[styles.loanDetailsBadge, { backgroundColor: loan?.approval_status === '2' ? COLORS.error : loan?.loan_status === '3' ? COLORS.success : COLORS.primary }]}>
                <Text style={styles.loanDetailsBadgeText}>{getLoanStatusLabel(loan)}</Text>
              </View>
</View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('loan.loanId')}</Text>
                <Text style={styles.detailValue}>#{loan?.id ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('customer.customer')}</Text>
                <Text style={styles.detailValue}>{loan?.customer_name ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('common.phone')}</Text>
                <Text style={styles.detailValue}>{loan?.customer_phone ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('customer.customerNo')}</Text>
                <Text style={styles.detailValue}>{loan?.customer_no ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('loan.branch')}</Text>
                <Text style={styles.detailValue}>{loan?.branch ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('loan.line')}</Text>
                <Text style={styles.detailValue}>{loan?.line_name ?? '—'}</Text>
              </View>
              {loan?.loantype_id != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('loan.loanTypeId')}</Text>
                  <Text style={styles.detailValue}>{loan.loantype_id}</Text>
                </View>
              )}

              {/* Amounts Section */}
              <Text style={styles.detailSectionTitle}>{t('loan.amounts')}</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('loan.loanAmount')}</Text>
                <Text style={styles.detailValueHighlight}>{formatLoanAmount(loan?.loan_amount)}</Text>
              </View>
              {loan?.approved_amount != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('loan.approvedAmount')}</Text>
                  <Text style={styles.detailValue}>{formatLoanAmount(loan?.approved_amount)}</Text>
                </View>
              )}
              {loan?.balance_amount != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('loan.balanceAmount')}</Text>
                  <Text style={styles.detailValue}>{formatLoanAmount(loan?.balance_amount)}</Text>
                </View>
              )}
              {loan?.intrest_amount != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('loan.interestAmount')}</Text>
                  <Text style={styles.detailValue}>{formatLoanAmount(loan?.intrest_amount)}</Text>
                </View>
              )}
              {loan?.processing_fees != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('loan.processingFees')}</Text>
                  <Text style={styles.detailValue}>{formatLoanAmount(loan?.processing_fees)}</Text>
                </View>
              )}
              {loan?.payment_type != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('loan.paymentType')}</Text>
                  <Text style={styles.detailValue}>{loan.payment_type}</Text>
                </View>
              )}

              {/* Dates & Period Section */}
              <Text style={styles.detailSectionTitle}>{t('loan.datesAndPeriod')}</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('loan.requestedDate')}</Text>
                <Text style={styles.detailValue}>{formatLoanDate(loan?.requested_date)}</Text>
              </View>
              {loan?.approved_date != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('loan.approvedDate')}</Text>
                  <Text style={styles.detailValue}>{formatLoanDate(loan.approved_date)}</Text>
                </View>
              )}
              {loan?.loan_period != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('loan.loanPeriod')}</Text>
                  <Text style={styles.detailValue}>{`${loan.loan_period} ${t('loan.months')}`}</Text>
                </View>
              )}
              {loan?.loan_closed_on != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('loan.closedOn')}</Text>
                  <Text style={styles.detailValue}>{formatLoanDate(loan.loan_closed_on)}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('loan.created')}</Text>
                <Text style={styles.detailValue}>{formatLoanDate(loan?.created_at)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('loan.updated')}</Text>
                <Text style={styles.detailValue}>{formatLoanDate(loan?.updated_at)}</Text>
              </View>

              {/* Location Section */}
              {(loan?.address_latitude || loan?.address_longitude || loan?.loangiven_latitude || loan?.loangiven_longitude) && (
                <>
                  <Text style={styles.detailSectionTitle}>{t('loan.location')}</Text>
                  {loan?.address_latitude && loan?.address_longitude && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('loan.addressLocation')}</Text>
                      <TouchableOpacity
                        onPress={() => handleMapPress(loan.address_latitude, loan.address_longitude, t('loan.addressLocation'))}
                        activeOpacity={0.7}
                      >
                        <View style={styles.locationButton}>
                          <Ionicons name="map-outline" size={18} color={COLORS.primary} />
                          <Text style={styles.locationButtonText}>{t('loan.viewOnMap')}</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                  {loan?.loangiven_latitude && loan?.loangiven_longitude && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('loan.loanGivenLocation')}</Text>
                      <TouchableOpacity
                        onPress={() => handleMapPress(loan.loangiven_latitude, loan.loangiven_longitude, t('loan.loanGivenLocation'))}
                        activeOpacity={0.7}
                      >
                        <View style={styles.locationButton}>
                          <Ionicons name="map-outline" size={18} color={COLORS.primary} />
                          <Text style={styles.locationButtonText}>{t('loan.viewOnMap')}</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {loan?.reject_reason && (
                <>
                  <Text style={styles.detailSectionTitle}>{t('loan.rejection')}</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('loan.reason')}</Text>
                    <Text style={[styles.detailValue, { color: COLORS.error }]}>{loan.reject_reason}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('loan.rejectedDate')}</Text>
                    <Text style={styles.detailValue}>{formatLoanDate(loan?.rejected_date)}</Text>
                  </View>
                </>
              )}

              {/* Images Section */}
              <Text style={styles.detailSectionTitle}>{t('loan.documents')}</Text>
              <View style={styles.imagesRow}>
                <TouchableOpacity
                  style={styles.imageIconContainer}
                  onPress={() => handleImagePress(loan?.customer_photo, t('loan.customerPhoto'))}
                  activeOpacity={0.7}
                >
                  {loan?.customer_photo ? (
                    <Image
                      source={{ uri: getImageUrl(loan.customer_photo) }}
                      style={styles.imageIcon}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imageIconPlaceholder}>
                      <Ionicons name="person-outline" size={32} color={COLORS.text.tertiary} />
                    </View>
                  )}
                  <Text style={styles.imageIconLabel}>{t('loan.customerPhoto')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imageIconContainer}
                  onPress={() => handleImagePress(loan?.address_proof, t('loan.addressProof'))}
                  activeOpacity={0.7}
                >
                  {loan?.address_proof ? (
                    <Image
                      source={{ uri: getImageUrl(loan.address_proof) }}
                      style={styles.imageIcon}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imageIconPlaceholder}>
                      <Ionicons name="home-outline" size={32} color={COLORS.text.tertiary} />
                    </View>
                  )}
                  <Text style={styles.imageIconLabel}>{t('loan.addressProof')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imageIconContainer}
                  onPress={() => handleImagePress(loan?.loangiven_photo, t('loan.loanGivenPhoto'))}
                  activeOpacity={0.7}
                >
                  {loan?.loangiven_photo ? (
                    <Image
                      source={{ uri: getImageUrl(loan.loangiven_photo) }}
                      style={styles.imageIcon}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imageIconPlaceholder}>
                      <Ionicons name="document-text-outline" size={32} color={COLORS.text.tertiary} />
                    </View>
                  )}
                  <Text style={styles.imageIconLabel}>{t('loan.loanGivenPhoto')}</Text>
                </TouchableOpacity>
              </View>

              {/* Approved: Process loan given — payment type + loan given photo */}
              {isLoanApproved && (
                <>
                  <Text style={styles.detailSectionTitle}>{t('loan.processLoanGiven') || 'Process Loan'}</Text>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>{t('loan.paymentType')}</Text>
                    <View style={styles.paymentTypeRow}>
                      {['cash', 'upi'].map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[styles.paymentTypeChip, paymentType === type && styles.paymentTypeChipActive]}
                          onPress={() => setPaymentType(type)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.paymentTypeChipText, paymentType === type && styles.paymentTypeChipTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.loanGivenImageSection}>
                    <Text style={styles.loanGivenImageLabel}>{t('loan.loanGivenPhoto')}</Text>
                    {loanGivenPhoto ? (
                      <View style={styles.loanGivenImagePreview}>
                        <Image source={{ uri: loanGivenPhoto.uri || loanGivenPhoto.localUri }} style={styles.loanGivenImage} resizeMode="cover" />
                        <TouchableOpacity style={styles.loanGivenRemoveButton} onPress={() => setLoanGivenPhoto(null)} activeOpacity={0.7}>
                          <Ionicons name="close-circle" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.loanGivenImageOptions}>
                        <TouchableOpacity style={styles.loanGivenImageOptionButton} onPress={handleLoanGivenPhotoCapture} activeOpacity={0.7}>
                          <Ionicons name="camera" size={30} color={COLORS.primary} />
                          <Text style={styles.loanGivenImageOptionText}>{t('customer.takePhoto') || 'Take Photo'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.loanGivenImageOptionButton} onPress={handleLoanGivenPhotoUpload} activeOpacity={0.7}>
                          <Ionicons name="image-outline" size={30} color={COLORS.primary} />
                          <Text style={styles.loanGivenImageOptionText}>{t('customer.chooseFromLibrary') || 'Choose from Library'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
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
              <Text style={styles.submitButtonText}>{t('common.processing')}</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>{loan && isLoanApproved ? (t('loan.update') || 'Update') : t('loan.processRenewal')}</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>

      {/* Full Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.imageViewerContainer}>
          <SafeAreaView style={styles.imageViewerSafeArea}>
            <View style={styles.imageViewerHeader}>
              <Text style={styles.imageViewerTitle}>{selectedImage?.title || t('common.image')}</Text>
              <TouchableOpacity
                style={styles.imageViewerCloseButton}
                onPress={closeImageViewer}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={28} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.imageViewerScrollContent}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bounces={false}
            >
              {selectedImage && (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

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
    paddingBottom: SIZES.padding * 4, // Reduced padding since button is fixed
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
  imagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SIZES.margin,
    paddingTop: SIZES.margin,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  imageIconContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: SIZES.base / 2,
  },
  imageIcon: {
    width: 80,
    height: 80,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
  },
  imageIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  imageIconLabel: {
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
    marginTop: SIZES.base / 2,
    textAlign: 'center',
    fontWeight: '500',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageViewerSafeArea: {
    flex: 1,
  },
  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageViewerTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: COLORS.white,
    flex: 1,
  },
  imageViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerScrollContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SCREEN_HEIGHT * 0.7,
    paddingVertical: SIZES.padding * 2,
  },
  fullImage: {
    width: SCREEN_WIDTH - (SIZES.padding * 2),
    height: SCREEN_HEIGHT * 0.7,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base * 0.5,
    borderRadius: SIZES.radius,
    gap: SIZES.base * 0.5,
  },
  locationButtonText: {
    fontSize: SIZES.body4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  paymentTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.base,
    marginTop: SIZES.base * 0.5,
  },
  paymentTypeChip: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  paymentTypeChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  paymentTypeChipText: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  paymentTypeChipTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  loanGivenPhotoRow: {
    flexDirection: 'row',
    gap: SIZES.base,
    marginTop: SIZES.base * 0.5,
  },
  loanGivenImageSection: {
    marginBottom: SIZES.margin,
  },
  loanGivenImageLabel: {
    fontSize: SIZES.body2,
    fontWeight: '500',
    color: COLORS.text?.primary || '#333',
    marginBottom: SIZES.base / 2,
  },
  loanGivenImagePreview: {
    position: 'relative',
    width: '100%',
    height: 120,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  loanGivenImage: {
    width: '100%',
    height: '100%',
  },
  loanGivenRemoveButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  loanGivenImageOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loanGivenImageOptionButton: {
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
  loanGivenImageOptionText: {
    fontSize: SIZES.body3,
    color: COLORS.text?.secondary || '#666',
    marginTop: SIZES.base / 2,
    fontWeight: '500',
  },
});

export default LoanScreen;

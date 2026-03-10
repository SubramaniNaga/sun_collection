import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';

const LoanScreen = ({ navigation, route }) => {
  // Get customer data from navigation params
  const { customerData } = route.params || {};

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

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCustomerPhoto(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo');
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

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 2],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAadharCardImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture Aadhar card photo');
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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 2],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAadharCardImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload Aadhar card');
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
        title="Loan Renewal"
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
          {/* Customer Info Display */}
          {customerData.name && (
            <View style={styles.customerInfoCard}>
              <View style={styles.customerInfoHeader}>
                <Text style={styles.customerInfoTitle}>Customer Information</Text>
              </View>

              <View style={styles.customerInfoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>{customerData.name}</Text>
                </View>
              </View>

              <View style={styles.customerInfoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Loan ID</Text>
                  <Text style={styles.infoValue}>{customerData.loanId}</Text>
                </View>
              </View>

              <View style={styles.customerInfoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{customerData.phone}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Loan Renewal Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Loan Renewal Details</Text>

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Initial Loan Amount</Text>
              <TextInput
                style={[styles.formInput, styles.readOnlyInput]}
                value={initialLoanAmount}
                editable={false}
                placeholder="0"
              />
            </View>

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Renewal Amount</Text>
              <TextInput
                style={styles.formInput}
                value={renewalAmount}
                onChangeText={setRenewalAmount}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            <View style={styles.formRow1}>
              <Text style={styles.formLabel}>Request Extra Funds</Text>
              <TouchableOpacity
                style={[styles.toggleButton, requestExtraFunds && styles.toggleButtonActive]}
                onPress={() => setRequestExtraFunds(!requestExtraFunds)}
              >
                <View style={[styles.toggleDot, requestExtraFunds && styles.toggleDotActive]} />
              </TouchableOpacity>
            </View>

            {requestExtraFunds && (
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Additional Amount Requested</Text>
                <TextInput
                  style={styles.formInput}
                  value={additionalAmount}
                  onChangeText={setAdditionalAmount}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
            )}
          </View>

          {/* KYC Verification */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>KYC Verification</Text>

            <View style={styles.photoSection}>
              <Text style={styles.formLabel}>Live Photo Capture</Text>
              <View style={styles.photoContainer}>
                {customerPhoto ? (
                  <View style={styles.photoPreview}>
                    <Image source={{ uri: customerPhoto.uri }} style={styles.photoImage} />
                    <TouchableOpacity style={styles.removePhotoButton} onPress={() => setCustomerPhoto(null)}>
                      <Ionicons name="close-circle" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.photoPlaceholder} onPress={handlePhotoCapture}>
                    <Ionicons name="camera" size={40} color={COLORS.text.tertiary} />
                    <Text style={styles.photoPlaceholderText}>Take Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!customerPhoto && (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredText}>Required</Text>
                </View>
              )}
            </View>
          </View>

          {/* Aadhar Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aadhar Verification</Text>

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Aadhar Number</Text>
              <View style={styles.aadharContainer}>
                <TextInput
                  style={[styles.formInput, styles.aadharInput]}
                  value={aadharNumber}
                  onChangeText={setAadharNumber}
                  keyboardType="numeric"
                  maxLength={12}
                  placeholder="Enter 12-digit Aadhar"
                />
                <TouchableOpacity style={styles.uploadButton} onPress={handleAadharUpload}>
                  <Ionicons name="cloud-upload-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Aadhar Card Image</Text>
              <View style={styles.aadharImageContainer}>
                {aadharCardImage ? (
                  <View style={styles.aadharPreview}>
                    <Image source={{ uri: aadharCardImage.uri }} style={styles.aadharImage} />
                    <TouchableOpacity style={styles.removeAadharButton} onPress={() => setAadharCardImage(null)}>
                      <Ionicons name="close-circle" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.aadharOptionsContainer}>
                    <TouchableOpacity style={styles.aadharOptionButton} onPress={handleAadharPhotoCapture}>
                      <Ionicons name="camera" size={30} color={COLORS.primary} />
                      <Text style={styles.aadharOptionText}>Capture Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.aadharOptionButton} onPress={handleAadharUpload}>
                      <Ionicons name="image-outline" size={30} color={COLORS.primary} />
                      <Text style={styles.aadharOptionText}>Upload Image</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>

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

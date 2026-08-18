import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { pickFromCamera, pickFromLibrary } from '../../utils/imagePickerHelper';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getDeviceId } from '../../utils/deviceId';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../api/apiClient';
import Button from '../../components/common/Button';
import Header from '../../components/common/Header';
import ImagePreviewModal from '../../components/common/ImagePreviewModal';
import ImageProcessingLoader from '../../components/common/ImageProcessingLoader';
import Input from '../../components/common/Input';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError, showSuccess, showWarning } from '../../utils/alertService';
import { guardAttendanceGatedEntry } from '../../utils/attendanceEntryGate';
import { safeGoBack } from '../../utils/navigationHelpers';

const AddCustomerScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  
  // Form states
  const [customerNo, setCustomerNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [askAmount, setAskAmount] = useState('');
  const [customerPhoto, setCustomerPhoto] = useState(null);
  const [aadharImage, setAadharImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [pickingImage, setPickingImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const customerNoRef = useRef(null);
  const customerNameRef = useRef(null);
  const customerPhoneRef = useRef(null);
  const customerAddressRef = useRef(null);
  const askAmountRef = useRef(null);
  const phoneAutoAdvancedRef = useRef(false);
  const customerPhotoRef = useRef(customerPhoto);
  customerPhotoRef.current = customerPhoto;

  const handlePhoneChange = (text) => {
    const numericValue = String(text || '').replace(/[^0-9]/g, '').slice(0, 10);
    setCustomerPhone(numericValue);
    if (numericValue.length === 10 && !phoneAutoAdvancedRef.current) {
      phoneAutoAdvancedRef.current = true;
      customerAddressRef.current?.focus();
    }
    if (numericValue.length < 10) {
      phoneAutoAdvancedRef.current = false;
    }
  };

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!customerNo.trim()) {
      newErrors.customerNo = 'Customer number is required';
    }
    if (!customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }
    if (!customerPhone.trim()) {
      newErrors.customerPhone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(customerPhone)) {
      newErrors.customerPhone = 'Phone number must be 10 digits';
    }
    if (!customerAddress.trim()) {
      newErrors.customerAddress = 'Address is required';
    }
    if (!askAmount.trim()) {
      newErrors.askAmount = 'Loan amount is required';
    } else if (parseFloat(askAmount) <= 0) {
      newErrors.askAmount = 'Amount must be greater than 0';
    }
    if (!customerPhoto) {
      newErrors.customerPhoto = 'Customer photo is required';
    }
    if (!aadharImage) {
      newErrors.aadharImage = 'Aadhar image is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle photo capture
  const handlePhotoCapture = async () => {
    setPickingImage('customer');
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        showWarning('Permission Required', 'Camera permission is required to take photo');
        return;
      }
      const asset = await pickFromCamera();
      if (asset) setCustomerPhoto(asset);
    } catch (error) {
      showError('Error', error?.message || 'Failed to capture photo. Please try again.');
    } finally {
      setPickingImage(null);
    }
  };

  // Handle Aadhar image upload
  const handleAadharUpload = async () => {
    setPickingImage('aadhar');
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showWarning('Permission Required', 'Gallery permission is required to select image');
        return;
      }
      const asset = await pickFromLibrary();
      if (asset) setAadharImage(asset);
    } catch (error) {
      showError('Error', error?.message || 'Failed to select Aadhar image. Please try again.');
    } finally {
      setPickingImage(null);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!guardAttendanceGatedEntry(t)) return;
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const deviceString = await getDeviceId();

      const formData = new FormData();
      formData.append('customer_no', customerNo);
      formData.append('customer_name', customerName);
      formData.append('customer_phoen', customerPhone);
      formData.append('customer_address', customerAddress);
      formData.append('customer_ask_amount', askAmount);
      formData.append('loan_start_at', new Date().toISOString().split('T')[0]);
      formData.append('device_id', deviceString);

      if (customerPhoto) {
        const photoUri = customerPhoto.uri;
        const photoName = photoUri.split('/').pop();
        formData.append('customer_photo', {
          uri: photoUri,
          name: photoName,
          type: 'image/jpeg',
        });
      }

      if (aadharImage) {
        const aadharUri = aadharImage.uri;
        const aadharName = aadharUri.split('/').pop();
        formData.append('aadhar_image', {
          uri: aadharUri,
          name: aadharName,
          type: 'image/jpeg',
        });
      }

      const response = await apiClient.post('/api/v1/customer', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        showSuccess('Success', 'Customer created successfully!', [
          { text: 'OK', onPress: () => safeGoBack(navigation) },
        ]);
      } else {
        showError('Error', response.data.message || 'Failed to create customer');
      }
    } catch (error) {
      showError('Error', getApiErrorMessage(error, 'Failed to create customer. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      
      <Header 
        title="Add Customer" 
        showBackButton={true}
        onBackPress={() => safeGoBack(navigation)} 
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Input
            ref={customerNoRef}
            label="Customer Number"
            value={customerNo}
            onChangeText={setCustomerNo}
            placeholder="Enter customer number"
            keyboardType="numeric"
            error={errors.customerNo}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => customerNameRef.current?.focus()}
          />

          <Input
            ref={customerNameRef}
            label="Customer Name"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Enter customer name"
            error={errors.customerName}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => customerPhoneRef.current?.focus()}
          />

          <Input
            ref={customerPhoneRef}
            label="Phone Number"
            value={customerPhone}
            onChangeText={handlePhoneChange}
            placeholder="Enter 10-digit phone number"
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.customerPhone}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => customerAddressRef.current?.focus()}
          />

          <Input
            ref={customerAddressRef}
            label="Address"
            value={customerAddress}
            onChangeText={setCustomerAddress}
            placeholder="Enter customer address"
            multiline
            numberOfLines={3}
            error={errors.customerAddress}
            required
            returnKeyType="next"
            blurOnSubmit
            submitBehavior="submit"
            onSubmitEditing={() => askAmountRef.current?.focus()}
          />

          <Input
            ref={askAmountRef}
            label="Loan Amount"
            value={askAmount}
            onChangeText={setAskAmount}
            placeholder="Enter loan amount"
            keyboardType="numeric"
            error={errors.askAmount}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              if (!customerPhotoRef.current) {
                handlePhotoCapture();
              }
            }}
          />

          <View style={styles.photoSection}>
            <Text style={styles.photoLabel}>Customer Photo</Text>
            <View style={styles.photoContainer}>
              {customerPhoto ? (
                <View style={styles.photoPreview}>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => pickingImage !== 'customer' && setPreviewImage({ uri: customerPhoto.uri, title: 'Customer Photo' })} disabled={pickingImage === 'customer'}>
                    <Image source={{ uri: customerPhoto.uri }} style={styles.photoImage} />
                    <View style={styles.previewHint}>
                      <Ionicons name="expand-outline" size={12} color={COLORS.white} />
                      <Text style={styles.previewHintText}>Preview</Text>
                    </View>
                  </TouchableOpacity>
                  {pickingImage !== 'customer' && (
                    <TouchableOpacity style={styles.removePhotoButton} onPress={() => setCustomerPhoto(null)}>
                      <Ionicons name="close-circle" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                  )}
                  {pickingImage === 'customer' ? <ImageProcessingLoader /> : null}
                </View>
              ) : (
                <View style={styles.photoPlaceholderWrap}>
                  {pickingImage !== 'customer' ? (
                    <TouchableOpacity style={styles.photoPlaceholder} onPress={handlePhotoCapture}>
                      <Ionicons name="camera" size={40} color={COLORS.text.tertiary} />
                      <Text style={styles.photoPlaceholderText}>Take Photo</Text>
                    </TouchableOpacity>
                  ) : null}
                  {pickingImage === 'customer' ? <ImageProcessingLoader /> : null}
                </View>
              )}
            </View>
            {errors.customerPhoto && (
              <Text style={styles.errorText}>{errors.customerPhoto}</Text>
            )}
          </View>

          <View style={styles.photoSection}>
            <Text style={styles.photoLabel}>Aadhar Card Image</Text>
            <View style={styles.photoContainer}>
              {aadharImage ? (
                <View style={styles.photoPreview}>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => pickingImage !== 'aadhar' && setPreviewImage({ uri: aadharImage.uri, title: 'Aadhar Card Image' })} disabled={pickingImage === 'aadhar'}>
                    <Image source={{ uri: aadharImage.uri }} style={styles.aadharImage} />
                    <View style={styles.previewHint}>
                      <Ionicons name="expand-outline" size={12} color={COLORS.white} />
                      <Text style={styles.previewHintText}>Preview</Text>
                    </View>
                  </TouchableOpacity>
                  {pickingImage !== 'aadhar' && (
                    <TouchableOpacity style={styles.removePhotoButton} onPress={() => setAadharImage(null)}>
                      <Ionicons name="close-circle" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                  )}
                  {pickingImage === 'aadhar' ? <ImageProcessingLoader /> : null}
                </View>
              ) : (
                <View style={styles.photoPlaceholderWrap}>
                  {pickingImage !== 'aadhar' ? (
                    <TouchableOpacity style={styles.photoPlaceholder} onPress={handleAadharUpload}>
                      <Ionicons name="image-outline" size={40} color={COLORS.text.tertiary} />
                      <Text style={styles.photoPlaceholderText}>Upload Aadhar</Text>
                    </TouchableOpacity>
                  ) : null}
                  {pickingImage === 'aadhar' ? <ImageProcessingLoader /> : null}
                </View>
              )}
            </View>
            {errors.aadharImage && (
              <Text style={styles.errorText}>{errors.aadharImage}</Text>
            )}
          </View>
        </ScrollView>
        
        {/* Fixed Bottom Button - Removed extra SafeAreaView wrapper */}
        <View style={[styles.fixedBottomContainer, { paddingBottom: insets.bottom + SIZES.padding * 0.5 }]}>
          <Button
            title="Create Customer"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
      </KeyboardAvoidingView>

      <ImagePreviewModal
        visible={!!previewImage}
        uri={previewImage?.uri ?? null}
        title={previewImage?.title ?? ''}
        onClose={() => setPreviewImage(null)}
      />
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
    paddingBottom: 100, // Ensure enough room for fixed button
  },
  photoSection: {
    marginBottom: SIZES.margin / 2,
  },
  photoLabel: {
    fontSize: SIZES.body2,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: SIZES.margin / 2,
  },
  photoPreview: {
    position: 'relative',
    width: 150,
    height: 150,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  aadharImage: {
    width: '100%',
    height: 120,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
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
  photoPlaceholderWrap: {
    position: 'relative',
    width: 150,
    height: 150,
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
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
  errorText: {
    color: COLORS.error,
    fontSize: SIZES.body4,
    marginTop: SIZES.base / 2,
  },
  fixedBottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 0.5,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitButton: {
    // Styling handled by component
  },
});

export default AddCustomerScreen;
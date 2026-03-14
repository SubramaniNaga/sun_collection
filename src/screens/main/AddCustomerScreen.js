import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { pickFromCamera, pickFromLibrary } from '../../utils/imagePickerHelper';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getDeviceId } from '../../utils/deviceId';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../api/apiClient';
import Button from '../../components/common/Button';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import { COLORS, SIZES } from '../../constants/theme';

const AddCustomerScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  // Form states
  const [customerNo, setCustomerNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [askAmount, setAskAmount] = useState('');
  const [customerPhoto, setCustomerPhoto] = useState(null);
  const [aadharImage, setAadharImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

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
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        showWarning('Permission Required', 'Camera permission is required to take photo');
        return;
      }
      const asset = await pickFromCamera([4, 3]);
      if (asset) setCustomerPhoto(asset);
    } catch (error) {
      console.error('Photo capture error:', error?.message ?? error);
      showError('Error', error?.message || 'Failed to capture photo. Please try again.');
    }
  };

  // Handle Aadhar image upload
  const handleAadharUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showWarning('Permission Required', 'Gallery permission is required to select image');
        return;
      }
      const asset = await pickFromLibrary([3, 2]);
      if (asset) setAadharImage(asset);
    } catch (error) {
      console.error('Aadhar upload error:', error?.message ?? error);
      showError('Error', error?.message || 'Failed to select Aadhar image. Please try again.');
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
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
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        showError('Error', response.data.message || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Create customer error:', error);
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
        onBackPress={() => navigation.goBack()} 
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
            label="Customer Number"
            value={customerNo}
            onChangeText={setCustomerNo}
            placeholder="Enter customer number"
            keyboardType="numeric"
            error={errors.customerNo}
            required
          />

          <Input
            label="Customer Name"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Enter customer name"
            error={errors.customerName}
            required
          />

          <Input
            label="Phone Number"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="Enter 10-digit phone number"
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.customerPhone}
            required
          />

          <Input
            label="Address"
            value={customerAddress}
            onChangeText={setCustomerAddress}
            placeholder="Enter customer address"
            multiline
            numberOfLines={3}
            error={errors.customerAddress}
            required
          />

          <Input
            label="Loan Amount"
            value={askAmount}
            onChangeText={setAskAmount}
            placeholder="Enter loan amount"
            keyboardType="numeric"
            error={errors.askAmount}
            required
          />

          <View style={styles.photoSection}>
            <Text style={styles.photoLabel}>Customer Photo</Text>
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
            {errors.customerPhoto && (
              <Text style={styles.errorText}>{errors.customerPhoto}</Text>
            )}
          </View>

          <View style={styles.photoSection}>
            <Text style={styles.photoLabel}>Aadhar Card Image</Text>
            <View style={styles.photoContainer}>
              {aadharImage ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: aadharImage.uri }} style={styles.aadharImage} />
                  <TouchableOpacity style={styles.removePhotoButton} onPress={() => setAadharImage(null)}>
                    <Ionicons name="close-circle" size={24} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.photoPlaceholder} onPress={handleAadharUpload}>
                  <Ionicons name="image-outline" size={40} color={COLORS.text.tertiary} />
                  <Text style={styles.photoPlaceholderText}>Upload Aadhar</Text>
                </TouchableOpacity>
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
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Button from '../../components/common/Button';
import FormPicker from '../../components/common/FormPicker';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import { COLORS, SIZES } from '../../constants/theme';

const CustomerWithLoanScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  // Form states
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTypeId, setLoanTypeId] = useState('');
  const [loanPeriod, setLoanPeriod] = useState('');
  const [addressLatitude, setAddressLatitude] = useState('');
  const [addressLongitude, setAddressLongitude] = useState('');
  const [customerNo, setCustomerNo] = useState('');
  
  // File states
  const [aadharImage, setAadharImage] = useState(null);
  const [customerPhoto, setCustomerPhoto] = useState(null);
  const [addressProof, setAddressProof] = useState(null);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [errors, setErrors] = useState({});

  // Mock data for dropdowns
  const loanTypeOptions = [
    { label: 'Personal Loan', value: '1' },
    { label: 'Business Loan', value: '2' },
    { label: 'Education Loan', value: '3' },
  ];

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!customerPhone.trim()) {
      newErrors.customerPhone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(customerPhone)) {
      newErrors.customerPhone = 'Phone number must be 10 digits';
    }
    if (!customerName.trim()) newErrors.customerName = 'Customer name is required';
    if (!customerAddress.trim()) newErrors.customerAddress = 'Address is required';
    if (!loanAmount.trim() || parseFloat(loanAmount) <= 0) {
      newErrors.loanAmount = 'Valid loan amount is required';
    }
    if (!loanTypeId) newErrors.loanTypeId = 'Loan type is required';
    if (!loanPeriod.trim() || parseInt(loanPeriod) <= 0) {
      newErrors.loanPeriod = 'Valid loan period is required';
    }
    if (!customerNo.trim()) newErrors.customerNo = 'Customer number is required';
    if (!aadharImage) newErrors.aadharImage = 'Aadhar image is required';
    if (!customerPhoto) newErrors.customerPhoto = 'Customer photo is required';
    if (!addressProof) newErrors.addressProof = 'Address proof is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Location capture
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

      setAddressLatitude(locationData.coords.latitude.toString());
      setAddressLongitude(locationData.coords.longitude.toString());
    } catch (error) {
      console.error('Location capture error:', error);
      Alert.alert('Error', 'Failed to capture location');
    } finally {
      setIsCapturingLocation(false);
    }
  };

  // Image handlers
  const handleImagePick = async (type, source) => {
    try {
      let result;
      if (source === 'camera') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission Required', 'Camera permission is required');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [3, 2],
          quality: 0.8,
        });
      } else {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission Required', 'Gallery permission is required');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [3, 2],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        switch (type) {
          case 'aadhar':
            setAadharImage(image);
            break;
          case 'customer':
            setCustomerPhoto(image);
            break;
          case 'address':
            setAddressProof(image);
            break;
        }
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${source === 'camera' ? 'capture' : 'pick'} image`);
    }
  };

  // Form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Get branch_id and line_id from storage
      const storedBranchId = await AsyncStorage.getItem('branch_id');
      const storedLineId = await AsyncStorage.getItem('line_id');
      
      if (!storedBranchId || !storedLineId) {
        Alert.alert('Error', 'Branch and Line information not found. Please login again.');
        return;
      }

      // Capture location automatically
      await captureLocation();

      const formData = new FormData();
      
      // Form fields - use stored values
      formData.append('customer_type', 'new'); // Default to new customer
      formData.append('branch_id', storedBranchId);
      formData.append('line_id', storedLineId);
      formData.append('customer_phone', customerPhone);
      formData.append('customer_name', customerName);
      formData.append('customer_address', customerAddress);
      formData.append('loan_amount', loanAmount);
      formData.append('loantype_id', loanTypeId);
      formData.append('loan_period', loanPeriod);
      formData.append('address_latitude', addressLatitude || '12.9716');
      formData.append('address_longitude', addressLongitude || '77.5946');
      formData.append('customer_no', customerNo);

      // Image files
      if (aadharImage) {
        formData.append('aadhar_image', {
          uri: aadharImage.uri,
          name: aadharImage.uri.split('/').pop(),
          type: 'image/jpeg',
        });
      }

      if (customerPhoto) {
        formData.append('customer_photo', {
          uri: customerPhoto.uri,
          name: customerPhoto.uri.split('/').pop(),
          type: 'image/jpeg',
        });
      }

      if (addressProof) {
        formData.append('address_proof', {
          uri: addressProof.uri,
          name: addressProof.uri.split('/').pop(),
          type: 'image/jpeg',
        });
      }

      const response = await apiServices.customer.createCustomerWithLoan(formData);
      
      if (response.success) {
        Alert.alert('Success', 'Customer and loan created successfully!');
        navigation.goBack();
      } else {
        Alert.alert('Error', response.message || 'Failed to create customer with loan');
      }
    } catch (error) {
      console.error('Create customer with loan error:', error);
      Alert.alert('Error', 'Failed to create customer with loan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderImageSection = (title, image, imageType) => (
    <View style={styles.imageSection}>
      <Text style={styles.imageLabel}>{title}</Text>
      {image ? (
        <View style={styles.imagePreview}>
          <Image source={{ uri: image.uri }} style={styles.image} />
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
        </View>
      ) : (
        <View style={styles.imageOptions}>
          <TouchableOpacity 
            style={styles.imageOptionButton} 
            onPress={() => handleImagePick(imageType, 'camera')}
          >
            <Ionicons name="camera" size={30} color={COLORS.primary} />
            <Text style={styles.imageOptionText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.imageOptionButton} 
            onPress={() => handleImagePick(imageType, 'gallery')}
          >
            <Ionicons name="image-outline" size={30} color={COLORS.primary} />
            <Text style={styles.imageOptionText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
      {errors[`${imageType}Image`] && (
        <Text style={styles.errorText}>{errors[`${imageType}Image`]}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" backgroundColor={COLORS.primary} />
      
      <Header 
        title="Create Customer with Loan" 
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
            label="Customer Phone"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="Enter 10-digit phone number"
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.customerPhone}
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
            label="Customer Address"
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
            value={loanAmount}
            onChangeText={setLoanAmount}
            placeholder="Enter loan amount"
            keyboardType="numeric"
            error={errors.loanAmount}
            required
          />

          <FormPicker
            label="Loan Type"
            value={loanTypeId}
            onValueChange={setLoanTypeId}
            items={loanTypeOptions}
            placeholder="Select loan type"
            error={errors.loanTypeId}
          />

          <Input
            label="Loan Period (months)"
            value={loanPeriod}
            onChangeText={setLoanPeriod}
            placeholder="Enter loan period in months"
            keyboardType="numeric"
            error={errors.loanPeriod}
            required
          />

          <Input
            label="Customer Number"
            value={customerNo}
            onChangeText={setCustomerNo}
            placeholder="Enter customer number"
            error={errors.customerNo}
            required
          />


          {renderImageSection('Aadhar Image', aadharImage, 'aadhar')}
          {renderImageSection('Customer Photo', customerPhoto, 'customer')}
          {renderImageSection('Address Proof', addressProof, 'address')}
        </ScrollView>
        
        <View style={[styles.fixedBottomContainer, { paddingBottom: insets.bottom + SIZES.padding * 0.5 }]}>
          <Button
            title="Create Customer with Loan"
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
    paddingBottom: 120,
  },
  imageSection: {
    marginBottom: SIZES.margin,
  },
  imageLabel: {
    fontSize: SIZES.body2,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
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
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
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

export default CustomerWithLoanScreen;

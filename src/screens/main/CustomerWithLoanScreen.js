import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Button from '../../components/common/Button';
import FormPicker from '../../components/common/FormPicker';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import { COLORS, SIZES } from '../../constants/theme';
import { pickFromCamera, pickFromLibrary } from '../../utils/imagePickerHelper';

const SEARCH_DEBOUNCE_MS = 400;

const CustomerWithLoanScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  // New vs Existing
  const [customerType, setCustomerType] = useState('New');
  const [existingSearch, setExistingSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const searchDebounceRef = useRef(null);
  
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
    { label: 'Monthly', value: '1' },
    { label: 'Weekly', value: '2' },
    // { label: 'Education Loan', value: '3' },
  ];

  const runCustomerSearch = useCallback(async (query) => {
    const q = (query || existingSearch || '').trim();
    if (!q) {
      setSearchResult(null);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const lineId = await AsyncStorage.getItem('lineId');
      const response = await apiServices.customer.searchCustomer(q, lineId);
      const data = response?.data ?? response;
      setSearchResult(data || null);
      if (!data) setSearchError('No customer found');
    } catch (err) {
      console.error('Customer search error:', err);
      setSearchResult(null);
      setSearchError(err.response?.data?.message || err.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }, [existingSearch]);

  useEffect(() => {
    if (customerType !== 'Existing') return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = existingSearch.trim();
    if (!q) {
      setSearchResult(null);
      setSearchError(null);
      return;
    }
    searchDebounceRef.current = setTimeout(() => runCustomerSearch(q), SEARCH_DEBOUNCE_MS);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [customerType, existingSearch, runCustomerSearch]);

  const openLoans = searchResult?.open_loans;
  const hasOpenLoans = Array.isArray(openLoans) && openLoans.length > 0;
  const canSubmitLoanForExisting = searchResult && !hasOpenLoans;

  // Handle phone input change (same as LoginScreen)
  const handlePhoneChange = (text) => {
    // Remove any non-numeric characters
    const numericValue = text.replace(/[^0-9]/g, '');
    
    // Enforce that first digit must be above 5 (6, 7, 8, or 9)
    if (numericValue.length > 0) {
      const firstDigit = parseInt(numericValue[0]);
      if (firstDigit <= 5) {
        return; // Don't allow if first digit is 0-5
      }
    }
    
    // Limit to 10 digits
    if (numericValue.length <= 10) {
      setCustomerPhone(numericValue);
      // Clear phone error when user starts typing
      if (errors.customerPhone) {
        setErrors({ ...errors, customerPhone: null });
      }
    }
  };

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!customerPhone) {
      newErrors.customerPhone = 'Phone number is required';
    } else if (customerPhone.length !== 10) {
      newErrors.customerPhone = 'Phone number must be exactly 10 digits';
    } else {
      const firstDigit = parseInt(customerPhone[0]);
      if (firstDigit <= 5) {
        newErrors.customerPhone = 'Phone number must start with 6, 7, 8, or 9';
      }
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
      console.error('Location capture error:', error);
      Alert.alert('Error', 'Failed to capture location');
      throw error;
    } finally {
      setIsCapturingLocation(false);
    }
  };

  // Image handlers
  const handleImagePick = async (type, source) => {
    try {
      if (source === 'camera') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission Required', 'Camera permission is required');
          return;
        }
        const image = await pickFromCamera([3, 2]);
        if (image) {
          if (type === 'aadhar') setAadharImage(image);
          else if (type === 'customer') setCustomerPhoto(image);
          else if (type === 'address') setAddressProof(image);
        }
      } else {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission Required', 'Gallery permission is required');
          return;
        }
        const image = await pickFromLibrary([3, 2]);
        if (image) {
          if (type === 'aadhar') setAadharImage(image);
          else if (type === 'customer') setCustomerPhoto(image);
          else if (type === 'address') setAddressProof(image);
        }
      }
    } catch (error) {
      console.error('Image pick error:', error?.message ?? error);
      Alert.alert('Error', error?.message || `Failed to ${source === 'camera' ? 'capture' : 'pick'} image. Please try again.`);
    }
  };

  // Form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Get branch_id and line_id from storage (keys match login: branchId, lineId)
      const storedBranchId = await AsyncStorage.getItem('branchId');
      const storedLineId = await AsyncStorage.getItem('lineId');
      
      if (!storedBranchId || !storedLineId) {
        Alert.alert('Error', 'Branch and Line information not found. Please login again.');
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
      const lat = coords?.latitude || '12.9716';
      const lng = coords?.longitude || '77.5946';

      const formData = new FormData();
      formData.append('customer_type', 'new');
      formData.append('customer_phone', customerPhone);
      formData.append('customer_name', customerName);
      formData.append('customer_address', customerAddress);
      formData.append('loan_amount', Number(loanAmount) || 0);
      formData.append('loantype_id', Number(loanTypeId) || 1);
      formData.append('loan_period', Number(loanPeriod) || 12);
      formData.append('address_latitude', lat);
      formData.append('address_longitude', lng);
      formData.append('customer_no', customerNo);
      // branch_id and line_id are added in apiServices from AsyncStorage

      const getFileName = (uri, fallback) => {
        const name = uri?.split?.('/')?.pop?.()?.split?.('?')?.[0];
        return (name && name.length > 0) ? name : fallback;
      };
      // Use correct MIME so backend receives binary image with proper Content-Type
      const getImageType = (uri, defaultName) => {
        const name = (uri ?? '').toLowerCase();
        return name.includes('.png') ? 'image/png' : 'image/jpeg';
      };

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

      const response = await apiServices.customer.createCustomerWithLoan(formData);
      const success = response?.success !== false && (response?.status !== 400 && response?.status !== 500);
      const message = response?.message || 'Customer and loan created successfully!';
      
      if (success) {
        Alert.alert('Success', message);
        navigation.goBack();
      } else {
        Alert.alert('Error', response?.message || message || 'Failed to create customer with loan');
      }
    } catch (error) {
      console.error('Create customer with loan error:', error);
      const errMsg = error.response?.data?.message || error.message || 'Failed to create customer with loan. Please try again.';
      Alert.alert('Error', errMsg);
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

      {/* New / Existing radio */}
      <View style={styles.radioRow}>
        <TouchableOpacity
          style={[styles.radioOption, customerType === 'New' && styles.radioOptionActive]}
          onPress={() => { setCustomerType('New'); setSearchResult(null); setSearchError(null); setExistingSearch(''); }}
        >
          <View style={[styles.radioCircle, customerType === 'New' && styles.radioCircleActive]}>
            {customerType === 'New' && <View style={styles.radioCircleInner} />}
          </View>
          <Text style={[styles.radioLabel, customerType === 'New' && styles.radioLabelActive]}>New</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.radioOption, customerType === 'Existing' && styles.radioOptionActive]}
          onPress={() => { setCustomerType('Existing'); }}
        >
          <View style={[styles.radioCircle, customerType === 'Existing' && styles.radioCircleActive]}>
            {customerType === 'Existing' && <View style={styles.radioCircleInner} />}
          </View>
          <Text style={[styles.radioLabel, customerType === 'Existing' && styles.radioLabelActive]}>Existing</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {customerType === 'New' && (
            <>
          <Input
            label="Customer Mobile Number"
            value={customerPhone}
            onChangeText={handlePhoneChange}
            placeholder="Enter 10-digit mobile number"
            keyboardType="phone-pad"
            autoCapitalize="none"
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
            </>
          )}

          {customerType === 'Existing' && (
            <View style={styles.existingSection}>
              <Text style={styles.existingSearchLabel}>Search by customer mobile or customer number</Text>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search" size={20} color={COLORS.text.tertiary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Enter mobile or customer number"
                  placeholderTextColor={COLORS.text.tertiary}
                  value={existingSearch}
                  onChangeText={setExistingSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchLoading && <ActivityIndicator size="small" color={COLORS.primary} style={styles.searchLoader} />}
              </View>
              {searchError && <Text style={styles.searchErrorText}>{searchError}</Text>}
              {searchResult && !searchLoading && (
                <View style={styles.existingResultCard}>
                  <Text style={styles.existingResultName}>{searchResult.customer_name ?? '—'}</Text>
                  <Text style={styles.existingResultMeta}>No. {searchResult.customer_no ?? '—'} · {searchResult.customer_phone ?? '—'}</Text>
                  {searchResult.customer_address ? <Text style={styles.existingResultAddress} numberOfLines={2}>{searchResult.customer_address}</Text> : null}
                  {hasOpenLoans ? (
                    <View style={styles.openLoansBadge}>
                      <Ionicons name="information-circle" size={20} color={COLORS.warning} />
                      <Text style={styles.openLoansText}>Customer has {openLoans.length} open loan(s). Cannot add new loan until existing loans are closed.</Text>
                    </View>
                  ) : (
                    <View style={styles.canSubmitBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                      <Text style={styles.canSubmitText}>No open loans. You can submit a new loan for this customer (submit API will be added later).</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
        
        {customerType === 'New' && (
        <View style={[styles.fixedBottomContainer]}>
          <Button
            title="Create Customer with Loan"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
        )}
      </KeyboardAvoidingView>
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
    color: COLORS.text.secondary,
    marginLeft: SIZES.base,
  },
  radioLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  existingSection: {
    padding: SIZES.padding,
  },
  existingSearchLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
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
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
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

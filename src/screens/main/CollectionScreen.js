import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import Collection from '../../models/Collection';

const SEARCH_DEBOUNCE_MS = 400;

// Format date as YYYY-MM-DD for API
const formatDateForAPI = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get current date in YYYY-MM-DD format
const getCurrentDateString = () => {
  return formatDateForAPI(new Date());
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
};

const formatAmount = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? '—' : `₹${num.toLocaleString('en-IN')}`;
};

const CollectionScreen = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [collectionData, setCollectionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const searchDebounceRef = useRef(null);
  
  // Payment collection modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [paymentMode, setPaymentMode] = useState('Cash'); // 'Cash' or 'Online'
  const [collectedAmount, setCollectedAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [paymentErrors, setPaymentErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCollectionData = useCallback(async (customerPhone = '', collectionDate = null) => {
    try {
      setLoading(true);
      setError(null);
      const dateToUse = collectionDate || selectedDate;
      const dateString = formatDateForAPI(dateToUse);
      
      const response = await apiServices.collection.getCollectionList({
        customer_phone: customerPhone.trim() || undefined,
        collection_date: dateString,
      });
      const raw = response?.response ?? response?.data ?? response?.data?.response;
      const list = Array.isArray(raw) ? raw : [];
      // Convert to Collection model instances
      const collectionModels = Collection.fromApiResponseArray(list);
      setCollectionData(collectionModels);
    } catch (err) {
      console.error('Failed to fetch collection data:', err);
      setError('Failed to load collection data. Please check your connection and try again.');
      setCollectionData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Load when screen is focused (initial load and when returning from CollectionDetails so list shows updated data)
  useFocusEffect(
    useCallback(() => {
      fetchCollectionData(searchText, selectedDate);
    }, [fetchCollectionData, searchText, selectedDate])
  );

  // When user types in search bar, call API with customer_phone for server-side filtering (debounced)
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      fetchCollectionData(searchText, selectedDate);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchText, fetchCollectionData, selectedDate]);

  // Handle date change
  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) {
        setSelectedDate(date);
        // Fetch data with new date
        fetchCollectionData(searchText, date);
      }
    } else {
      // iOS - update date as user scrolls, but don't fetch until "Done" is pressed
      if (date) {
        setSelectedDate(date);
      }
    }
  };

  const filteredData = Array.isArray(collectionData) ? collectionData : [];

  const handleItemPress = (item) => {
    // Show payment collection modal instead of navigating
    const collection = item instanceof Collection ? item : new Collection(item);
    setSelectedCollection(collection);
    setPaymentMode('Cash');
    setCollectedAmount('');
    setRemarks('');
    setPaymentErrors({});
    setShowPaymentModal(true);
  };

  const handlePhonePress = (phoneNumber) => {
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.openURL(phoneUrl)
      .then((supported) => {
        if (!supported) {
          Alert.alert('Error', 'Phone dialer not available');
        }
      })
      .catch((err) => {
        console.error('Error opening phone dialer:', err);
        Alert.alert('Error', 'Could not open phone dialer');
      });
  };

  const handleMapPress = (address) => {
    if (!address || !address.trim()) {
      Alert.alert('Error', 'Address not available');
      return;
    }

    // Encode the address for URL
    const encodedAddress = encodeURIComponent(address.trim());
    
    // Try Google Maps app first, fallback to web
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    const googleMapsAppUrl = `comgooglemaps://?q=${encodedAddress}`;
    
    // Try to open Google Maps app, fallback to web
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
        // Fallback to web version
        Linking.openURL(googleMapsUrl).catch((fallbackErr) => {
          console.error('Error opening Google Maps web:', fallbackErr);
          Alert.alert('Error', 'Could not open Google Maps. Please check if Google Maps is installed.');
        });
      });
  };

  const validatePaymentForm = () => {
    const errors = {};
    
    if (!collectedAmount || collectedAmount.trim() === '') {
      errors.collectedAmount = 'Collected amount is required';
    } else {
      const amount = parseFloat(collectedAmount);
      if (isNaN(amount) || amount <= 0) {
        errors.collectedAmount = 'Please enter a valid amount';
      } else if (selectedCollection) {
        // Check if collected amount exceeds balance amount
        const balanceAmount = parseFloat(selectedCollection.balanceAmount) || 0;
        if (amount > balanceAmount) {
          errors.collectedAmount = `Collected amount cannot exceed balance amount (${selectedCollection.getFormattedBalanceAmount()})`;
        }
      }
    }
    
    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getCurrentLocation = async (retryCount = 0) => {
    try {
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        const userAction = await new Promise((resolve) => {
          Alert.alert(
            'Location Services Disabled',
            'Please enable location services (GPS) in your device settings to continue. Make sure GPS/Location is turned ON.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve('cancel'),
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'android') {
                    Linking.openSettings();
                  } else {
                    Linking.openURL('app-settings:');
                  }
                  resolve('settings');
                },
              },
              {
                text: 'Retry',
                onPress: () => resolve('retry'),
              },
            ]
          );
        });
        
        if (userAction === 'cancel') {
          throw new Error('Location services are disabled - user cancelled');
        } else if (userAction === 'retry' && retryCount < 3) {
          // Wait a bit and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          return getCurrentLocation(retryCount + 1);
        } else if (userAction === 'settings') {
          // User opened settings, wait a bit longer and check again
          await new Promise(resolve => setTimeout(resolve, 2000));
          const isEnabledAfter = await Location.hasServicesEnabledAsync();
          if (!isEnabledAfter && retryCount < 2) {
            // Give user another chance
            return getCurrentLocation(retryCount + 1);
          } else if (!isEnabledAfter) {
            throw new Error('Location services are still disabled. Please enable GPS/Location in device settings and try again.');
          }
        }
      }

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        const userAction = await new Promise((resolve) => {
          Alert.alert(
            'Location Permission Required',
            'Location permission is required to submit the payment. Please grant location permission in app settings.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve('cancel'),
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'android') {
                    Linking.openSettings();
                  } else {
                    Linking.openURL('app-settings:');
                  }
                  resolve('settings');
                },
              },
            ]
          );
        });
        
        if (userAction === 'cancel') {
          throw new Error('Location permission denied - user cancelled');
        } else {
          // Wait a bit after opening settings, then check again
          await new Promise(resolve => setTimeout(resolve, 2000));
          const { status: newStatus } = await Location.getForegroundPermissionsAsync();
          if (newStatus !== 'granted') {
            throw new Error('Location permission denied - please enable in settings');
          }
        }
      }

      // Get current location with retry logic
      try {
        const locationData = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 20000, // 20 seconds timeout
          maximumAge: 10000, // Accept cached location up to 10 seconds old
        });

        return {
          latitude: locationData.coords.latitude,
          longitude: locationData.coords.longitude,
        };
      } catch (locationError) {
        // If getting position fails, it might be because GPS is still acquiring signal
        if (retryCount < 2) {
          console.log('Location acquisition failed, retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return getCurrentLocation(retryCount + 1);
        }
        throw locationError;
      }
    } catch (error) {
      // Only log if it's not a user cancellation
      if (!error.message?.includes('user cancelled')) {
        console.error('Error getting location:', error);
      }
      throw error;
    }
  };

  const handleSubmitPayment = async () => {
    if (!validatePaymentForm()) {
      return;
    }

    if (!selectedCollection || !selectedCollection.id) {
      Alert.alert('Error', 'Collection information not available');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current location
      let latitude = null;
      let longitude = null;
      
      try {
        const location = await getCurrentLocation();
        latitude = location.latitude;
        longitude = location.longitude;
      } catch (locationError) {
        // Check if user cancelled or if it's a permission/service issue
        const isUserCancelled = locationError.message?.includes('user cancelled');
        
        if (!isUserCancelled) {
          // Ask user if they want to continue without location
          const shouldContinue = await new Promise((resolve) => {
            Alert.alert(
              'Location Error',
              'Failed to get your location. Do you want to continue without location data?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve(false),
                },
                {
                  text: 'Continue',
                  onPress: () => resolve(true),
                },
              ]
            );
          });

          if (!shouldContinue) {
            setIsSubmitting(false);
            return;
          }
        } else {
          // User cancelled, stop submission
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        amount_paid: parseFloat(collectedAmount),
        payment_mode: paymentMode, // Add payment mode (Cash or Online)
      };

      // Add location if available
      if (latitude !== null && longitude !== null) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      // Add remarks if provided
      if (remarks && remarks.trim()) {
        payload.notes = remarks.trim();
      }

      await apiServices.collection.updateAmount(selectedCollection.id, payload);
      
      Alert.alert('Success', 'Collection amount updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            setShowPaymentModal(false);
            // Refresh the collection list
            fetchCollectionData(searchText, selectedDate);
          },
        },
      ]);
    } catch (err) {
      console.error('Failed to update collection amount:', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to update collection amount. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedCollection(null);
    setPaymentMode('Cash');
    setCollectedAmount('');
    setRemarks('');
    setPaymentErrors({});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" backgroundColor={COLORS.primary} />
      <Header
        title="Collection"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.text.tertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by phone..."
              placeholderTextColor={COLORS.text.tertiary}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          <Pressable
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.datePickerText}>
              {formatDate(selectedDate.toISOString())}
            </Text>
          </Pressable>
        </View>

        {showDatePicker && (
          Platform.OS === 'ios' ? (
            <Modal
              transparent={true}
              animationType="slide"
              visible={showDatePicker}
              onRequestClose={() => setShowDatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.modalButton}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Select Date</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowDatePicker(false);
                        fetchCollectionData(searchText, selectedDate);
                      }}
                    >
                      <Text style={[styles.modalButton, styles.modalButtonDone]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    onChange={handleDateChange}
                  />
                </View>
              </View>
            </Modal>
          ) : (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
          )
        )}

        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.centerContainer}>
              <Text style={styles.loadingText}>Loading collection data...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => fetchCollectionData('', selectedDate)}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredData.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No collections found</Text>
            </View>
          ) : (
            filteredData.map((item) => {
              // Handle both Collection model instances and plain objects
              const collection = item instanceof Collection ? item : new Collection(item);
              return (
                <TouchableOpacity
                  key={collection.id}
                  style={styles.listItem}
                  onPress={() => handleItemPress(collection)}
                >
                  <View style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={1}>{collection.customerNo} - {collection.customerName ?? '—'}</Text>
                    <View style={styles.iconButtonContainer}>
                      {collection.customerAddress && (
                        <TouchableOpacity
                          style={styles.inlineIconButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleMapPress(collection.customerAddress);
                          }}
                        >
                          <Ionicons name="map-outline" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                      )}
                      {collection.customerPhone && (
                        <TouchableOpacity
                          style={styles.inlineIconButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handlePhonePress(collection.customerPhone);
                          }}
                        >
                          <Ionicons name="call" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemAssets}>
                      Week {collection.collectionWeek ?? '—'} · {collection.getFormattedCollectionDate()}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: collection.getStatusColor() }]}>
                      <Text style={styles.statusText}>{collection.getStatusText()}</Text>
                    </View>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemMetaLeft}>Paid: {collection.getFormattedAmountPaid()}</Text>
                    <Text style={styles.itemMetaRight}>Balance: {collection.getFormattedBalanceAmount()}</Text>
                  </View>
                  {/*{collection.locality && (
                    <View style={[styles.itemRow, styles.itemRowLast]}>
                      <Text style={styles.itemLocality} numberOfLines={1}>{collection.locality}</Text>
                    </View>
                  )}
                  {(collection.customerNo || collection.branchName || collection.lineName) && (
                    <View style={[styles.itemRow, styles.itemRowLast]}>
                      {collection.customerNo && (
                        <Text style={styles.itemMetaLeft}>Customer No: {collection.customerNo}</Text>
                      )}
                      {collection.branchName && (
                        <Text style={styles.itemMetaRight}>{collection.branchName}</Text>
                      )}
                    </View>
                  )}*/}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Payment Collection Bottom Sheet Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClosePaymentModal}
      >
        <KeyboardAvoidingView
          style={styles.paymentModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Pressable
            style={styles.paymentModalOverlayInner}
            onPress={handleClosePaymentModal}
          >
            <Pressable
              style={styles.paymentModalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <SafeAreaView edges={['bottom']}>
                <View style={styles.paymentModalHeader}>
                  <Text style={styles.paymentModalTitle}>Collect Payment</Text>
                  <TouchableOpacity onPress={handleClosePaymentModal}>
                    <Ionicons name="close" size={24} color={COLORS.text.secondary} />
                  </TouchableOpacity>
                </View>

                {selectedCollection && (
                  <ScrollView
                    style={styles.paymentModalScrollView}
                    contentContainerStyle={styles.paymentModalBody}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerInfoName}>
                        {selectedCollection.customerNo} - {selectedCollection.customerName}
                      </Text>
                      <Text style={styles.customerInfoBalance}>
                        Balance: {selectedCollection.getFormattedBalanceAmount()}
                      </Text>
                    </View>

                    {/* Payment Mode Radio Buttons */}
                    <View style={styles.paymentModeContainer}>
                      <Text style={styles.fieldLabel}>Payment Mode</Text>
                      <View style={styles.radioButtonContainer}>
                        <TouchableOpacity
                          style={styles.radioButton}
                          onPress={() => setPaymentMode('Cash')}
                        >
                          <View style={styles.radioButtonCircle}>
                            {paymentMode === 'Cash' && <View style={styles.radioButtonInner} />}
                          </View>
                          <Text style={styles.radioButtonLabel}>Cash</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.radioButton}
                          onPress={() => setPaymentMode('Online')}
                        >
                          <View style={styles.radioButtonCircle}>
                            {paymentMode === 'Online' && <View style={styles.radioButtonInner} />}
                          </View>
                          <Text style={styles.radioButtonLabel}>Online</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Collected Amount Input */}
                    <View style={styles.inputFieldContainer}>
                      <Text style={styles.fieldLabel}>Collected Amount *</Text>
                      <TextInput
                        style={[
                          styles.inputField,
                          paymentErrors.collectedAmount && styles.inputFieldError,
                        ]}
                        placeholder="Enter amount"
                        placeholderTextColor={COLORS.text.tertiary}
                        value={collectedAmount}
                        keyboardType="numeric"
                        onChangeText={(text) => {
                          // Remove non-digits
                          const digitsOnly = text.replace(/[^0-9]/g, '');
                          
                          // If there's a balance amount, restrict input
                          if (selectedCollection && digitsOnly) {
                            const balanceAmount = parseFloat(selectedCollection.balanceAmount) || 0;
                            const enteredAmount = parseFloat(digitsOnly);
                            
                            // If entered amount exceeds balance, cap it at balance
                            if (!isNaN(enteredAmount) && enteredAmount > balanceAmount) {
                              // Set to balance amount
                              setCollectedAmount(String(balanceAmount));
                              // Show error message
                              setPaymentErrors({
                                ...paymentErrors,
                                collectedAmount: `Amount cannot exceed balance (${selectedCollection.getFormattedBalanceAmount()})`,
                              });
                              return;
                            }
                          }
                          
                          // Update amount
                          setCollectedAmount(digitsOnly);
                          
                          // Clear error if amount is valid
                          if (paymentErrors.collectedAmount) {
                            setPaymentErrors({ ...paymentErrors, collectedAmount: '' });
                          }
                        }}
                      />
                      {paymentErrors.collectedAmount && (
                        <Text style={styles.errorTextSmall}>{paymentErrors.collectedAmount}</Text>
                      )}
                    </View>

                    {/* Remarks Input */}
                    <View style={styles.inputFieldContainer}>
                      <Text style={styles.fieldLabel}>Remarks</Text>
                      <TextInput
                        style={[styles.inputField, styles.textArea]}
                        placeholder="Enter remarks (optional)"
                        placeholderTextColor={COLORS.text.tertiary}
                        value={remarks}
                        onChangeText={setRemarks}
                        multiline
                        numberOfLines={3}
                      />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                      onPress={handleSubmitPayment}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.submitButtonText}>
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </SafeAreaView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    paddingTop: SIZES.padding * 1.5,
  },
  headerTitle: {
    fontSize: SIZES.h2,
    fontWeight: '700',
    color: COLORS.white,
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.margin,
    gap: SIZES.base,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SIZES.base / 2,
  },
  datePickerText: {
    fontSize: SIZES.body3,
    color: COLORS.text.primary,
  },
  searchIcon: {
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
  },
  listContainer: {
    flex: 1,
  },
  listItem: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    marginBottom: SIZES.base,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base,
    minHeight: 24,
  },
  itemRowLast: {
    marginBottom: 0,
  },
  itemName: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
    marginRight: SIZES.base,
  },
  iconButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base / 2,
  },
  inlineIconButton: {
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  itemAssets: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    flex: 1,
    marginRight: SIZES.base,
  },
  itemMetaLeft: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
  },
  itemMetaRight: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginLeft: SIZES.base,
  },
  itemLocality: {
    fontSize: SIZES.body4,
    color: COLORS.text.tertiary,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius / 2,
    minWidth: 56,
    alignItems: 'center',
  },
  statusText: {
    fontSize: SIZES.body5,
    color: COLORS.white,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 3,
  },
  loadingText: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: SIZES.body2,
    color: COLORS.error || '#FF4444',
    textAlign: 'center',
    marginBottom: SIZES.margin,
  },
  errorTextSmall: {
    fontSize: SIZES.body4,
    color: COLORS.error || '#FF4444',
    marginTop: SIZES.base / 2,
  },
  emptyText: {
    fontSize: SIZES.body2,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    marginTop: SIZES.margin,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    paddingBottom: Platform.OS === 'ios' ? 40 : SIZES.padding,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  modalButton: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
  },
  modalButtonDone: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Payment Modal Styles
  paymentModalOverlay: {
    flex: 1,
  },
  paymentModalOverlayInner: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  paymentModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '90%',
    width: '100%',
  },
  paymentModalScrollView: {
    maxHeight: 600,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  paymentModalTitle: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  paymentModalBody: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  customerInfo: {
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  customerInfoName: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  customerInfoBalance: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
  },
  paymentModeContainer: {
    marginBottom: SIZES.margin,
  },
  fieldLabel: {
    fontSize: SIZES.body3,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: SIZES.base,
  },
  radioButtonContainer: {
    flexDirection: 'row',
    gap: SIZES.padding * 2,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
  },
  radioButtonCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  radioButtonLabel: {
    fontSize: SIZES.body2,
    color: COLORS.black,
  },
  inputFieldContainer: {
    marginBottom: SIZES.margin,
  },
  inputField: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    fontSize: SIZES.body2,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  inputFieldError: {
    borderColor: COLORS.error || '#FF4444',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.padding,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SIZES.margin,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body1,
    fontWeight: '600',
  },
});

export default CollectionScreen;

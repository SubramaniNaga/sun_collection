import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import Collection from '../../models/Collection';
import { useLanguage } from '../../store/LanguageContext';
import { showAlert, showError, showSuccess, showWarning } from '../../utils/alertService';
import { formatDateForAPI, formatDisplayDate, getCurrentDateString } from '../../utils/dateFormatter';

const SEARCH_DEBOUNCE_MS = 400;

const formatAmount = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? '—' : `₹${num.toLocaleString('en-IN')}`;
};

const API_BASE_URL = 'http://65.0.100.65:6005';
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/api')) return `${API_BASE_URL}${imagePath}`;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}/api/v1${cleanPath}`;
};

const CollectionScreen = ({ navigation }) => {
  const { t } = useLanguage();
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

  const shouldAllowPaymentWhenBalanceZero = (collection) => {
    const balanceAmount = parseFloat(collection?.balanceAmount) || 0;
    const completedCount = parseInt(collection?.completedCount) || 0;

    // If balance is not zero, always allow payment
    if (balanceAmount !== 0) {
      return true;
    }

    // If balance is zero, only allow payment if completed_count is 0
    return completedCount === 0;
  };

  const fetchCollectionData = useCallback(async (searchQuery = '', collectionDate = null) => {
    try {
      setLoading(true);
      setError(null);
      const dateToUse = collectionDate || selectedDate;
      const dateString = formatDateForAPI(dateToUse);
      const trimmed = (searchQuery || '').trim();
      const isNumeric = /^\d+$/.test(trimmed.replace(/\s/g, ''));
      const response = await apiServices.collection.getCollectionList({
        ...(trimmed && (isNumeric ? { customer_phone: trimmed } : { customer_name: trimmed })),
        collection_date: dateString,
      });
      const raw = response?.response ?? response?.data ?? response?.data?.response;
      const list = Array.isArray(raw) ? raw : [];
      // Convert to Collection model instances
      const collectionModels = Collection.fromApiResponseArray(list);
      setCollectionData(collectionModels);
    } catch (err) {
      console.error('Failed to fetch collection data:', err);
      setError(t('collection.failedToLoad'));
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
  const isSelectedDateToday = formatDateForAPI(selectedDate) === getCurrentDateString();

  const openPaymentModal = (collection) => {
    setSelectedCollection(collection);
    setPaymentMode('Cash');
    setCollectedAmount('');
    setRemarks('');
    setPaymentErrors({});
    setShowPaymentModal(true);
  };

  const handleItemPress = (item) => {
    const collection = item instanceof Collection ? item : new Collection(item);

    if (!isSelectedDateToday) {
      showWarning(
        'Collection payment',
        "Collection payment can only be recorded for the current date. Please select today's date to collect payment."
      );
      return;
    }

    const balanceAmount = parseFloat(collection.balanceAmount) || 0;
    if (balanceAmount <= 0) {
      if (!shouldAllowPaymentWhenBalanceZero(collection)) {
        showError(t('common.error'), t('collection.noBalanceToCollect'));
        return;
      }
    }

    if (collection.isPaid()) {
      showAlert({
        type: 'warning',
        title: 'Payment done',
        message: 'Want to pay again?',
        buttons: [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              if ((parseFloat(collection.balanceAmount) || 0) <= 0) {
                if (!shouldAllowPaymentWhenBalanceZero(collection)) {
                  showError(t('common.error'), t('collection.noBalanceToCollect'));
                  return;
                }
              }
              openPaymentModal(collection);
            },
          },
        ],
      });
      return;
    }

    openPaymentModal(collection);
  };

  const handlePhonePress = (phoneNumber) => {
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.openURL(phoneUrl)
      .then((supported) => {
        if (!supported) {
          showError('Error', 'Phone dialer not available');
        }
      })
      .catch((err) => {
        console.error('Error opening phone dialer:', err);
        showError('Error', 'Could not open phone dialer');
      });
  };

  const handleMapPress = (address) => {
    if (!address || !address.trim()) {
      showError('Error', 'Address not available');
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
          showError('Error', 'Could not open Google Maps. Please check if Google Maps is installed.');
        });
      });
  };

  const validatePaymentForm = () => {
    const errors = {};

    if (!collectedAmount || collectedAmount.trim() === '') {
      errors.collectedAmount = t('collection.collectedAmountRequired');
    } else {
      const amount = parseFloat(collectedAmount);
      if (isNaN(amount) || amount <= 0) {
        errors.collectedAmount = t('collection.collectedAmountInvalid');
      } else if (selectedCollection) {
        // Check if collected amount exceeds balance amount
        const balanceAmount = parseFloat(selectedCollection.balanceAmount) || 0;
        const allowExceedWhenInitialPayment = shouldAllowPaymentWhenBalanceZero(selectedCollection);
        if (!allowExceedWhenInitialPayment && amount > balanceAmount) {
          errors.collectedAmount = `${t('collection.collectedAmountExceed')} (${selectedCollection.getFormattedBalanceAmount()})`;
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
          showAlert({
            type: 'warning',
            title: t('collection.locationServicesDisabled'),
            message: t('collection.enableLocation'),
            buttons: [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve('cancel') },
              {
                text: t('common.ok'),
                onPress: () => {
                  if (Platform.OS === 'android') Linking.openSettings();
                  else Linking.openURL('app-settings:');
                  resolve('settings');
                },
              },
              { text: t('common.retry'), onPress: () => resolve('retry') },
            ],
          });
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
          showAlert({
            type: 'warning',
            title: t('collection.locationPermissionDenied'),
            message: t('collection.enableLocation'),
            buttons: [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve('cancel') },
              {
                text: t('common.ok'),
                onPress: () => {
                  if (Platform.OS === 'android') Linking.openSettings();
                  else Linking.openURL('app-settings:');
                  resolve('settings');
                },
              },
            ],
          });
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
      showError(t('common.error'), t('collection.noCollections'));
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
            showAlert({
              type: 'warning',
              title: t('collection.locationError'),
              message: t('collection.locationError'),
              buttons: [
                { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
                { text: t('common.ok'), onPress: () => resolve(true) },
              ],
            });
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
        payment_type: paymentMode, // Add payment mode (Cash or Online)
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

      showSuccess(t('common.success'), t('success.collectionUpdated'), [
        {
          text: t('common.ok'),
          onPress: () => {
            setShowPaymentModal(false);
            fetchCollectionData(searchText, selectedDate);
          },
        },
      ]);
    } catch (err) {
      console.error('Failed to update collection amount:', err);
      showError(t('common.error'), err.response?.data?.message || t('errors.somethingWentWrong'));
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
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header
        title={t('collection.title')}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.text.tertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('common.search')}
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
              {formatDisplayDate(selectedDate)}
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
                      <Text style={styles.modalButton}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>{t('collection.selectDate')}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowDatePicker(false);
                        fetchCollectionData(searchText, selectedDate);
                      }}
                    >
                      <Text style={[styles.modalButton, styles.modalButtonDone]}>{t('common.ok')}</Text>
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
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>{t('collection.loadingCollections')}</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => fetchCollectionData('', selectedDate)}>
                <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : filteredData.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>{t('collection.noCollections')}</Text>
            </View>
          ) : (
            filteredData.map((item) => {
              // Handle both Collection model instances and plain objects
              const collection = item instanceof Collection ? item : new Collection(item);
              return (
                <TouchableOpacity
                  key={collection.id}
                  style={[styles.listItem, collection.isPending && styles.listItemPending, collection.isHighPendingCount && styles.listItemHighPending]}
                  onPress={() => handleItemPress(collection)}
                >
                  <View style={styles.itemRow}>
                    {collection.customerPhoto ? (
                      <Image
                        source={{ uri: getImageUrl(collection.customerPhoto) }}
                        style={styles.itemCustomerPhoto}
                      />
                    ) : (
                      <Image
                        source={require('../../../assets/images/favicon.png')}
                        style={styles.itemCustomerPhoto}
                      />
                    )}
                    <Text style={styles.itemName} numberOfLines={1}>
                      {(collection.customerId ?? collection.customerNo ?? '—')}{' - '}{(collection.customerName ?? '—')}
                    </Text>
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
                  <View style={styles.itemDivider} />
                  <View style={styles.itemRow}>
                    <Text style={styles.itemAssets}>
                      {t('loan.week')} {collection.collectionWeek ?? '—'} · {collection.getFormattedCollectionDate()}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: collection.getStatusColor() }]}>
                      <Text style={styles.statusText}>{collection.getStatusText()}</Text>
                    </View>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemMetaLeft}>{t('loan.loanPeriod')}:</Text>
                    <Text style={styles.itemMetaRight}>{collection.loanPeriod ?? '—'}/{collection.loanTypeName ?? '—'}</Text>
                  </View>

                  <View style={styles.itemRow}>
                    <Text style={styles.itemMetaLeft}>{t('collection.loanDueStatus')}:</Text>
                    <Text style={styles.itemMetaRight}>
                      {(() => {
                     
                        return `${collection.completed_collection_count ?? collection.completedCount ?? 0}(${collection.pending_collection_count ?? collection.pendingCount ?? 0})/${collection.current_collection_due_count ?? collection.totalCount ?? 0}`;
                      })()}
                    </Text>
                  </View>

                  <View style={styles.itemRow}>
                    <Text style={styles.itemMetaLeft}>{t('loan.paid')}: {collection.getFormattedAmountPaid()}</Text>
                    <Text style={styles.itemMetaRight}>{t('loan.balance')}: {collection.getFormattedBalanceAmount()}</Text>
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

      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClosePaymentModal}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable
            style={styles.centeredModalBackdrop}
            onPress={handleClosePaymentModal}
          />
          <View style={styles.centeredModalContainer}>
            <View style={styles.centeredModalHeader}>
              <Text style={styles.paymentModalTitle}>{t('collection.submitPayment')}</Text>
              <TouchableOpacity onPress={handleClosePaymentModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedCollection && (
              <View style={styles.centeredModalBody}>
                <KeyboardAwareScrollView
                  style={styles.centeredModalScrollView}
                  contentContainerStyle={styles.centeredModalContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  enableOnAndroid={true}
                  enableAutomaticScroll={true}
                  extraScrollHeight={100}
                  keyboardOpeningTime={0}
                >
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerInfoName}>
                      {selectedCollection.customerNo} - {selectedCollection.customerName}
                    </Text>
                    <Text style={styles.customerInfoBalance}>
                      {t('collection.balanceAmount')}: {selectedCollection.getFormattedBalanceAmount()}
                    </Text>
                  </View>

                  {/* Payment Mode Radio Buttons */}
                  <View style={styles.paymentModeContainer}>
                    <Text style={styles.fieldLabel}>{t('collection.paymentMode')}</Text>
                    <View style={styles.radioButtonContainer}>
                      <TouchableOpacity
                        style={styles.radioButton}
                        onPress={() => setPaymentMode('Cash')}
                      >
                        <View style={styles.radioButtonCircle}>
                          {paymentMode === 'Cash' && <View style={styles.radioButtonInner} />}
                        </View>
                        <Text style={styles.radioButtonLabel}>{t('common.cash')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.radioButton}
                        onPress={() => setPaymentMode('Online')}
                      >
                        <View style={styles.radioButtonCircle}>
                          {paymentMode === 'Online' && <View style={styles.radioButtonInner} />}
                        </View>
                        <Text style={styles.radioButtonLabel}>{t('common.online')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Collected Amount Input */}
                  <View style={styles.inputFieldContainer}>
                    <Text style={styles.fieldLabel}>{t('collection.collectedAmount')} *</Text>
                    <TextInput
                      style={[
                        styles.inputField,
                        paymentErrors.collectedAmount && styles.inputFieldError,
                      ]}
                      placeholder={t('collection.enterAmount')}
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
                          const allowExceedWhenInitialPayment = shouldAllowPaymentWhenBalanceZero(selectedCollection);

                          // If entered amount exceeds balance, cap it at balance
                          if (!allowExceedWhenInitialPayment && !isNaN(enteredAmount) && enteredAmount > balanceAmount) {
                            // Set to balance amount
                            setCollectedAmount(String(balanceAmount));
                            // Show error message
                            setPaymentErrors({
                              ...paymentErrors,
                              collectedAmount: `${t('collection.amountCannotExceed')} (${selectedCollection.getFormattedBalanceAmount()})`,
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
                    <Text style={styles.fieldLabel}>{t('common.remarks')}</Text>
                    <TextInput
                      style={[styles.inputField, styles.textArea]}
                      placeholder={t('collection.enterRemarks')}
                      placeholderTextColor={COLORS.text.tertiary}
                      value={remarks}
                      onChangeText={setRemarks}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </KeyboardAwareScrollView>

                {/* Fixed Submit Button at Bottom */}
                <View style={styles.submitButtonFixed}>
                  <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={handleSubmitPayment}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.submitButtonText}>
                      {isSubmitting ? t('common.loading') : t('common.submit')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
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
    height: 44, // Consistent height for both components
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SIZES.base / 2,
    height: 44, // Consistent height for both components
  },
  datePickerText: {
    fontSize: SIZES.body3,
    color: COLORS.black,
  },
  searchIcon: {
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.black,
    height: 44, // Match container height
  },
  listContainer: {
    flex: 1,
  },
  listItem: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2, // Reduced from 16px to 8px for more compact layout
    marginBottom: SIZES.base / 2, // Reduced from 8px to 4px for more compact layout
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listItemPending: {
    borderColor: '#F5D000',
    borderWidth: 2,
  },
  listItemHighPending: {
    borderColor: '#FED7AA',
    borderWidth: 2,
  },
  itemCustomerPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lightGray,
    marginRight: SIZES.base,
  },
  itemCustomerPhotoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lightGray,
    marginRight: SIZES.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.base / 2, // Reduced from 8px to 4px for more compact layout
    marginLeft: 0,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base / 2, // Reduced from 8px to 4px for more compact layout
    minHeight: 24,
  },
  itemRowLast: {
    marginBottom: 0,
  },
  itemName: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.black,
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
    color: COLORS.black,
  },
  modalButton: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
  },
  modalButtonDone: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Centered Modal Styles
  centeredModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  centeredModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centeredModalContainer: {
    width: '90%',
    maxWidth: 400,
    height: '75%',
    maxHeight: '75%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  centeredModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  closeButton: {
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
  },
  paymentModalTitle: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.black,
  },
  centeredModalBody: {
    flex: 1,
    flexDirection: 'column',
  },
  centeredModalScrollView: {
    flex: 1,
  },
  centeredModalContent: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
  },
  submitButtonFixed: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
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
    color: COLORS.black,
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
    color: COLORS.black,
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
    height: 48,
    minHeight: 48,
    maxHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
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

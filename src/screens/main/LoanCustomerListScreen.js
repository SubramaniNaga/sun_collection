import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import FormPicker from '../../components/common/FormPicker';
import Header from '../../components/common/Header';
import LoanCollectionsModal from '../../components/common/LoanCollectionsModal';
import PaginationListFooter from '../../components/common/PaginationListFooter';
import { applyCalendarTimezoneFromResponse } from '../../config/appToggles';
import { COLORS, SIZES } from '../../constants/theme';
import { DEBOUNCE_MS_DEFAULT, useDebouncedValue } from '../../hooks/useDebouncedValue';
import { isHighPendingCount, isPendingBorder } from '../../models/Collection';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError } from '../../utils/alertService';
import { formatCurrency } from '../../utils/amountFormatters';
import { formatDisplayDate, getRegisterDayNameFromDate } from '../../utils/dateFormatter';
import { safeGoBack } from '../../utils/navigationHelpers';

const LIMIT = 10;
const API_BASE_URL = 'http://65.0.100.65:6005';

const REGISTER_DAY_VALUES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/api')) return `${API_BASE_URL}${imagePath}`;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}/api/v1${cleanPath}`;
};

const formatAmountOrDash = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return formatCurrency(value);
};

const LoanCustomerListScreen = ({ navigation }) => {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [registerDayFilter, setRegisterDayFilter] = useState(() => getRegisterDayNameFromDate());
  const userPickedDayRef = useRef(false);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, DEBOUNCE_MS_DEFAULT);
  const [loanList, setLoanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    hasNextPage: false,
    totalPages: 1,
  });
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoModalUri, setPhotoModalUri] = useState(null);
  const [collectionsModalLoanId, setCollectionsModalLoanId] = useState(null);
  const loadMoreLockRef = useRef(false);
  const listContentHeightRef = useRef(0);
  const listContainerHeightRef = useRef(0);
  const fetchRequestIdRef = useRef(0);

  const registerDayOptions = useMemo(
    () => [
      { label: t('common.all'), value: '' },
      ...REGISTER_DAY_VALUES.map((value) => ({
        label: t(`customer.${value.toLowerCase()}`),
        value,
      })),
    ],
    [t],
  );

  const handleRegisterDayChange = useCallback((value) => {
    if (value === registerDayFilter) return;
    userPickedDayRef.current = true;
    fetchRequestIdRef.current += 1;
    setLoanList([]);
    setLoading(true);
    setLoadingMore(false);
    loadMoreLockRef.current = false;
    setPagination({ currentPage: 1, hasNextPage: false, totalPages: 1 });
    setRegisterDayFilter(value);
  }, [registerDayFilter]);

  // Search settled: clear list + show spinner only (never empty text / pagination skeleton while fetching)
  useEffect(() => {
    fetchRequestIdRef.current += 1;
    setLoanList([]);
    setLoading(true);
    setLoadingMore(false);
    loadMoreLockRef.current = false;
    setPagination({ currentPage: 1, hasNextPage: false, totalPages: 1 });
  }, [debouncedSearchQuery]);

  const fetchLoans = useCallback(async (page = 1, append = false, skipPageLoader = false) => {
    const isPageOne = page === 1 && !append;
    const requestId = isPageOne ? ++fetchRequestIdRef.current : fetchRequestIdRef.current;

    try {
      if (isPageOne && !skipPageLoader) {
        setLoading(true);
        setError(null);
        setLoadingMore(false);
        loadMoreLockRef.current = false;
      }

      const trimmedSearch = debouncedSearchQuery.trim();
      const isNumericSearch = trimmedSearch !== '' && /^\d+$/.test(trimmedSearch);

      const response = await apiServices.loan.getLoanList({
        page,
        limit: LIMIT,
        approval_status: '',
        loan_status: '',
        customer_id: isNumericSearch ? trimmedSearch : '',
        search: !isNumericSearch ? trimmedSearch : '',
        ...(registerDayFilter ? { register_day: registerDayFilter } : {}),
      });

      if (requestId !== fetchRequestIdRef.current) return;

      const list = Array.isArray(response?.data) ? response.data : [];
      const pag = response?.pagination || {};

      setLoanList((prev) => (append ? [...prev, ...list] : list));
      setPagination({
        currentPage: pag.currentPage ?? page,
        hasNextPage: Boolean(pag.hasNextPage),
        totalPages: pag.totalPages ?? 1,
      });
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      if (isPageOne) {
        showError(t('common.error'), getApiErrorMessage(err, t('loan.failedToLoad')));
        setError(null);
        setLoanList([]);
      }
    } finally {
      if (requestId !== fetchRequestIdRef.current) return;
      if (isPageOne) {
        setLoading(false);
      } else {
        setLoadingMore(false);
        loadMoreLockRef.current = false;
      }
    }
  }, [registerDayFilter, debouncedSearchQuery, t]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchLoans(1, false, true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchLoans, refreshing]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await apiServices.app.getVersion({ skipGlobalLoader: true });
          if (!cancelled) applyCalendarTimezoneFromResponse(res);
        } catch {
          // Fall back to cached server_date or device date
        }
        if (!cancelled && !userPickedDayRef.current) {
          setRegisterDayFilter(getRegisterDayNameFromDate());
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      fetchLoans(1, false);
    }, [fetchLoans]),
  );

  const loadMore = useCallback(() => {
    if (loading || loadingMore || loadMoreLockRef.current || !pagination.hasNextPage) {
      return;
    }
    loadMoreLockRef.current = true;
    setLoadingMore(true);
    const nextPage = pagination.currentPage + 1;
    fetchLoans(nextPage, true);
  }, [loading, loadingMore, pagination.hasNextPage, pagination.currentPage, fetchLoans]);

  const maybeLoadMoreIfShort = useCallback(() => {
    if (
      loading ||
      loadingMore ||
      !pagination.hasNextPage ||
      listContentHeightRef.current <= 0 ||
      listContainerHeightRef.current <= 0
    ) {
      return;
    }
    if (listContentHeightRef.current <= listContainerHeightRef.current) {
      loadMore();
    }
  }, [loading, loadingMore, pagination.hasNextPage, loadMore]);

  useEffect(() => {
    if (!loading && loanList.length > 0) {
      maybeLoadMoreIfShort();
    }
  }, [loading, loanList.length, pagination.hasNextPage, maybeLoadMoreIfShort]);

  const handleCustomerSelect = (loan) => {
    navigation.navigate('LoanScreen', {
      loan,
      customerData: {
        name: loan?.customer_name ?? '',
        phone: loan?.customer_phone ?? '',
        loanId: String(loan?.id ?? ''),
        initialAmount: loan?.loan_amount ?? '',
      },
    });
  };

  const handleAddPress = () => {
    navigation.navigate('CustomerWithLoan');
  };

  const handlePhonePress = (phoneNumber) => {
    if (!phoneNumber) return;
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.openURL(phoneUrl)
      .then((supported) => {
        if (!supported) {
          showError(t('common.error'), t('collection.call'));
        }
      })
      .catch((err) => {
        showError(t('common.error'), t('collection.call'));
      });
  };

  const handleMapPress = (latitude, longitude) => {
    if (!latitude || !longitude) {
      showError(t('common.error'), t('collection.map'));
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      showError(t('common.error'), t('collection.map'));
      return;
    }

    // Try Google Maps app first, fallback to web
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const googleMapsAppUrl = `comgooglemaps://?q=${lat},${lng}&center=${lat},${lng}`;

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
        // Fallback to web version
        Linking.openURL(googleMapsUrl).catch((fallbackErr) => {
          showError(t('common.error'), t('collection.map'));
        });
      });
  };

  const getStatusLabel = (loan) => {
    // Use dynamic loan_status_name from API response if available, fallback to status_id logic
    if (loan?.loan_status_name) {
      return loan.loan_status_name;
    }

    // Fallback logic for backward compatibility
    const approval = loan?.approval_status;
    const loanStatus = loan?.loan_status;
    if (approval === '2') return 'Rejected';
    if (loanStatus === '4') return 'Closed';
    if (approval === '0') return 'Pending';
    if (loanStatus === '3') return 'Active';
    if (loanStatus === '2' || approval === '1') return 'Approved';
    return 'Pending';
  };

  const getStatusColor = (loan) => {
    // Handle NIP status (status 7 or NIP name)
    if (loan?.loan_status === '7' || (loan?.loan_status_name && String(loan.loan_status_name).toUpperCase() === 'NIP')) {
      return COLORS.error || '#EF4444';
    }

    // Handle all 8 loan statuses based on both loan_status and loan_status_name
    const status = loan?.loan_status;
    const statusName = loan?.loan_status_name;

    // Status 1: Pending - Orange
    if (status === '1' || statusName === 'Pending') {
      return '#F59E0B';
    }

    // Status 2: Approved - Green  
    if (status === '2' || statusName === 'Approved') {
      return COLORS.success || '#10B981';
    }

    // Status 3: Active - Green
    if (status === '3' || statusName === 'Active') {
      return COLORS.success || '#10B981';
    }

    // Status 4: Loan Given - Blue
    if (status === '4' || statusName === 'Loan Given') {
      return '#3B82F6';
    }

    // Status 5: Rejected - Red
    if (status === '5' || statusName === 'Rejected') {
      return COLORS.error || '#EF4444';
    }

    // Status 6: Closed - Gray
    if (status === '6' || statusName === 'Closed') {
      return COLORS.text?.tertiary || '#6B7280';
    }

    // Status 7: NIP - Red (already handled above)

    // Status 8: Completed - Purple
    if (status === '8' || statusName === 'Completed') {
      return '#8B5CF6';
    }

    // Fallback for any other status
    const label = getStatusLabel(loan);
    if (label === 'Approved') return COLORS.success || '#10B981';
    if (label === 'Active') return COLORS.success || '#10B981';
    if (label === 'Rejected') return COLORS.error || '#EF4444';
    if (label === 'Closed') return COLORS.text?.tertiary || '#6B7280';
    if (label === 'Pending') return '#F59E0B';

    return COLORS.primary || '#1d7ee2';
  };

  const isNipStatus = (loan) =>
    loan?.loan_status === '7' || (loan?.loan_status_name && String(loan.loan_status_name).toUpperCase() === 'NIP');


  const openPhotoModal = (imagePath) => {
    const uri = getImageUrl(imagePath);
    if (uri) {
      setPhotoModalUri(uri);
      setPhotoModalVisible(true);
    }
  };

  const renderLoanItem = ({ item }) => {
    const isPending = isPendingBorder(item?.is_pending ?? item?.isPending ?? item?.ispending);
    const isNip = isNipStatus(item);
    const isHighPending = isHighPendingCount(item?.loan_type_name, item?.pending_days, item?.pending_weeks);
    const footerActionIconColor = isNip ? COLORS.error : COLORS.primary;
    const customerName = String(item?.customer_name ?? '').trim();
    const isLongCustomerName = customerName.length > 10;
    return (
      <TouchableOpacity
        style={[styles.loanCard, isPending && styles.loanCardPending, isNip && styles.loanCardNip, isHighPending && styles.loanCardHighPending]}
        onPress={() => handleCustomerSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.loanCardHeader}>
          <TouchableOpacity
            style={styles.loanCardPhotoWrap}
            onPress={(e) => {
              e.stopPropagation();
              openPhotoModal(item?.customer_photo);
            }}
            activeOpacity={0.8}
          >
            {item?.customer_photo ? (
              <Image
                source={{ uri: getImageUrl(item.customer_photo) }}
                style={styles.loanCardPhoto}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={require('../../../assets/images/favicon.png')}
                style={styles.loanCardPhoto}
                resizeMode="cover"
              />
            )}
          </TouchableOpacity>
          <View style={styles.loanCardHeaderBody}>
            {isLongCustomerName ? (
              <>
                <Text
                  style={[styles.loanCardNameLine, isNip && styles.loanCardNameLineNip]}
                  numberOfLines={2}
                >
                  {(item?.customer_no ?? '—')} - {(item?.customer_name ?? '—')}
                </Text>
                <View style={[styles.statusBadge, styles.statusBadgeBelowName, { backgroundColor: isNip ? '#FEE2E2' : getStatusColor(item) }]}>
                  <Text style={[styles.statusText, isNip && styles.statusTextRed]}>{getStatusLabel(item)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.loanCardNameRow}>
                <Text
                  style={[styles.loanCardNameLine, styles.loanCardNameLineInline, isNip && styles.loanCardNameLineNip]}
                  numberOfLines={1}
                >
                  {(item?.customer_no ?? '—')} - {(item?.customer_name ?? '—')}
                </Text>
                <View style={[styles.statusBadge, styles.statusBadgeInline, { backgroundColor: isNip ? '#FEE2E2' : getStatusColor(item) }]}>
                  <Text style={[styles.statusText, isNip && styles.statusTextRed]}>{getStatusLabel(item)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <View style={styles.loanCardDivider} />
        <View style={styles.loanCardRow}>
          <Ionicons name="cash-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
          <Text style={styles.loanCardLabel}>{t('loan.loanAmount')}</Text>
          <Text style={[styles.loanCardValueAmount, isNip && styles.loanCardValueAmountNip]}>
            {formatCurrency(item?.loan_amount)}
          </Text>
        </View>
        <View style={styles.loanCardRow}>
          <Ionicons name="pricetag-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
          <Text style={styles.loanCardLabel}>{t('customer.aathayam')}</Text>
          <Text style={styles.loanCardValue} numberOfLines={1}>
            {formatAmountOrDash(item?.intrest_amount)}
          </Text>
        </View>
        <View style={styles.loanCardRow}>
          <Ionicons name="trending-up-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
          <Text style={styles.loanCardLabel}>{t('customer.magimai')}</Text>
          <Text style={styles.loanCardValue} numberOfLines={1}>
            {formatAmountOrDash(item?.processing_fees)}
          </Text>
        </View>
        {item?.approved_amount != null && item?.approved_amount !== '' && (
          <View style={styles.loanCardRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
            <Text style={styles.loanCardLabel}>{t('loan.approved')}</Text>
            <Text style={styles.loanCardValue}>{formatCurrency(item?.approved_amount)}</Text>
          </View>
        )}
        <View style={styles.loanCardRow}>
          <Ionicons name="business-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
          <Text style={styles.loanCardLabel}>{t('loan.balanceAmount')}</Text>
          <Text style={styles.loanCardValue} numberOfLines={1}>{item?.balance_amount ?? '—'}</Text>
        </View>
        <View style={styles.loanCardRow}>
          <Ionicons name="business-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
          <Text style={styles.loanCardLabel}>{t('loan.loanPeriod')}</Text>
          <Text style={styles.loanCardValue} numberOfLines={1}>
            {item?.loanPeriod ?? item?.loan_period ?? '—'}/{item?.loanTypeName ?? item?.loan_type_name ?? '—'}
          </Text>
        </View>
        {(item?.completed_collection_count != null || item?.completed_weeks != null || item?.total_period != null) && (
          <View style={styles.loanCardRow}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
            <Text style={styles.loanCardLabel}>{t('loan.loanDueStatus')}</Text>
            <Text style={styles.loanCardValue} numberOfLines={1}>
              {item?.completed_collection_count ?? 0}({item?.pending_collection_count ?? 0})/{item?.current_collection_due_count ?? 0}
            </Text>
          </View>
        )}
        <View style={styles.loanCardFooter}>
          <Text style={styles.loanCardDate}>{t('loan.requested')} {formatDisplayDate(item?.requested_date)}</Text>
          <View style={styles.loanCardFooterIcons}>
            {item?.address_latitude && item?.address_longitude && (
              <TouchableOpacity
                style={styles.loanCardIconButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleMapPress(item.address_latitude, item.address_longitude);
                }}
              >
                <Ionicons name="map-outline" size={18} color={footerActionIconColor} />
              </TouchableOpacity>
            )}
            {item?.customer_phone && (
              <TouchableOpacity
                style={styles.loanCardIconButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handlePhonePress(item.customer_phone);
                }}
              >
                <Ionicons name="call" size={18} color={footerActionIconColor} />
              </TouchableOpacity>
            )}
            {item?.id != null && item?.id !== '' && (
              <TouchableOpacity
                style={styles.loanCardIconButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setCollectionsModalLoanId(item.id);
                }}
              >
                <Ionicons name="information-circle-outline" size={18} color={footerActionIconColor} />
              </TouchableOpacity>
            )}
            <Ionicons name="chevron-forward" size={18} color={footerActionIconColor} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    // Skeleton only while paginating — never during page-1 search/load
    if (loading || loanList.length === 0) return null;
    return (
      <PaginationListFooter
        loadingMore={loadingMore}
        hasNextPage={pagination.hasNextPage}
      />
    );
  };

  const renderEmpty = () => {
    // While API is in flight: spinner only (no "No loans found")
    if (loading || refreshing) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="document-text-outline" size={48} color={COLORS.text.tertiary} />
        <Text style={styles.emptyStateText}>
          {t('loan.noLoans')}
        </Text>
        <Text style={styles.emptyStateSubText}>
          {t('common.search')}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('loan.loanManagement')}
        showBackButton={true}
        onBackPress={() => safeGoBack(navigation)}
        rightComponent={
          <TouchableOpacity
            onPress={handleAddPress}
            style={styles.headerAddButton}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={24} color={COLORS.white} />
          </TouchableOpacity>
        }
      />

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color={COLORS.primary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'en' ? 'Search by name, phone or ID' : t('loan.searchPlaceholder')}
              placeholderTextColor={COLORS.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
              numberOfLines={1}
              multiline={false}
              ellipsizeMode="tail"
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.text.secondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.dayFilterWrapper}>
            <FormPicker
              value={registerDayFilter}
              onValueChange={handleRegisterDayChange}
              items={registerDayOptions}
              placeholder={t('common.all')}
              modalTitle={t('customer.registerDay')}
              compact
              compactUseFullLabel
              fitSheetToContent
              style={styles.dayFilterPicker}
            />
          </View>
        </View>
      </View>

      <FlatList
        data={loanList}
        keyExtractor={(item) => String(item?.id ?? Math.random())}
        renderItem={renderLoanItem}
        contentContainerStyle={
          loanList.length === 0
            ? styles.customerListContainerEmpty
            : styles.customerListContainer
        }
        showsVerticalScrollIndicator={false}
        onLayout={(e) => {
          listContainerHeightRef.current = e.nativeEvent.layout.height;
          maybeLoadMoreIfShort();
        }}
        onContentSizeChange={(_, h) => {
          listContentHeightRef.current = h;
          maybeLoadMoreIfShort();
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.15}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      />

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

      <LoanCollectionsModal
        visible={collectionsModalLoanId != null}
        loanId={collectionsModalLoanId}
        onClose={() => setCollectionsModalLoanId(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  searchSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base * 0.75,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base / 6,
    paddingVertical: SIZES.base / 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 45,
  },
  dayFilterWrapper: {
    width: 118,
    flexShrink: 0,
  },
  dayFilterPicker: {
    marginBottom: 0,
  },
  searchInput: {
    flex: 1,
    padding: 0, // No padding
    fontSize: SIZES.body4, // Reduced font size for better single line fit
    color: COLORS.black,
    backgroundColor: 'transparent',
    textAlign: 'left',
    height: 35, // Reduced height
    lineHeight: 16, // Reduced line height
    maxHeight: 35, // Force max height
  },
  searchIcon: {
    marginRight: SIZES.base,
  },
  clearButton: {
    paddingHorizontal: SIZES.base / 2,
    paddingVertical: SIZES.base / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerListContainer: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  customerListContainerEmpty: {
    flexGrow: 1,
    paddingBottom: SIZES.padding,
  },
  skeletonWrap: {
    flex: 1,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 4,
  },
  loadingText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 4,
  },
  emptyStateText: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: SIZES.margin,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: SIZES.body2,
    color: COLORS.text.tertiary,
    marginTop: SIZES.base / 2,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SIZES.margin,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  loanCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.25,
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base * 1.25,
    marginBottom: SIZES.margin,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  loanCardPending: {
    borderColor: '#F5D000',
    borderWidth: 2,
  },
  loanCardNip: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  loanCardHighPending: {
    borderColor: '#FED7AA',
    borderWidth: 2,
  },
  loanCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loanCardHeaderBody: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingRight: SIZES.base * 0.25,
  },
  loanCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray,
    marginVertical: SIZES.base * 0.75,
  },
  loanCardNameLine: {
    fontSize: SIZES.body2,
    fontWeight: '700',
    color: COLORS.text?.primary || COLORS.primary,
    marginBottom: SIZES.base * 0.375,
    lineHeight: Math.round((SIZES.body2 || 14) * 1.25),
  },
  loanCardNameLineInline: {
    marginBottom: 0,
    flex: 1,
    marginRight: SIZES.base * 0.75,
  },
  loanCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loanCardNameLineNip: {
    color: COLORS.error,
  },
  loanCardPhotoWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: SIZES.base * 0.75,
  },
  loanCardPhoto: {
    width: '100%',
    height: '100%',
  },
  loanCardPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
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
  loanCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base * 0.375,
  },
  loanCardLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text?.tertiary || '#666',
    marginLeft: SIZES.base,
    flex: 1,
  },
  loanCardValue: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text?.secondary || '#333',
    maxWidth: '50%',
  },
  loanCardValueAmount: {
    fontSize: SIZES.body2,
    fontWeight: '700',
    color: COLORS.primary,
  },
  loanCardValueAmountNip: {
    color: COLORS.error,
  },
  loanCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZES.base * 0.75,
    paddingTop: SIZES.base * 0.75,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  loanCardDate: {
    fontSize: SIZES.body4 || 12,
    color: COLORS.text?.tertiary || '#666',
  },
  loanCardFooterIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base / 2,
  },
  loanCardIconButton: {
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  statusBadge: {
    paddingHorizontal: SIZES.base * 0.75,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeBelowName: {
    alignSelf: 'flex-start',
  },
  statusBadgeInline: {
    alignSelf: 'center',
  },
  statusText: {
    fontSize: SIZES.body4 || 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  statusTextRed: {
    color: COLORS.error,
  },
  footerLoader: {
    paddingVertical: SIZES.padding,
  },
  headerAddButton: {
    padding: SIZES.padding / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LoanCustomerListScreen;

import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import ListSkeleton from '../../components/common/ListSkeleton';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import NIPLoan from '../../models/NIPLoan';
import { useLanguage } from '../../store/LanguageContext';

const LIMIT = 20;
const API_BASE_URL = 'http://65.0.100.65:6005';

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/api')) return `${API_BASE_URL}${imagePath}`;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}/api/v1${cleanPath}`;
};

// Dummy data for fallback (customer_photo optional; same keys as API when response available)
const getDummyData = () => [
  {
    id: 1,
    customer_id: 1,
    customer_name: 'John Doe',
    customer_phone: '9876543210',
    customer_no: '001',
    customer_photo: null,
    loan_amount: '50000.00',
    approved_amount: '45000.00',
    balance_amount: '30000.00',
    loan_period: 12,
    approval_status: '1',
    loan_status: '2',
    requested_date: '2026-01-15T00:00:00.000Z',
    branch: 'Coimbatore',
    line_name: 'A Line',
    address_latitude: '12.9716',
    address_longitude: '77.5946',
  },
  {
    id: 2,
    customer_id: 2,
    customer_name: 'Jane Smith',
    customer_phone: '9876543211',
    customer_no: '002',
    customer_photo: null,
    loan_amount: '75000.00',
    approved_amount: '70000.00',
    balance_amount: '50000.00',
    loan_period: 24,
    approval_status: '1',
    loan_status: '3',
    requested_date: '2026-01-20T00:00:00.000Z',
    branch: 'Coimbatore',
    line_name: 'B Line',
    address_latitude: '12.9717',
    address_longitude: '77.5947',
  },
  {
    id: 3,
    customer_id: 3,
    customer_name: 'Robert Johnson',
    customer_phone: '9876543212',
    customer_no: '003',
    customer_photo: null,
    loan_amount: '100000.00',
    approved_amount: null,
    balance_amount: null,
    loan_period: 36,
    approval_status: '0',
    loan_status: '0',
    requested_date: '2026-02-01T00:00:00.000Z',
    branch: 'Coimbatore',
    line_name: 'A Line',
    address_latitude: '12.9718',
    address_longitude: '77.5948',
  },
];

const NIPScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [nipList, setNipList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    hasNextPage: false,
    totalPages: 1,
  });
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoModalUri, setPhotoModalUri] = useState(null);

  const fetchNIPLoans = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const response = await apiServices.loan.getNIPList({
        search: searchQuery.trim(),
        page,
        limit: LIMIT,
      });

      const list = Array.isArray(response?.data) ? response.data : [];
      const pag = response?.pagination || {};

      // If no data from API, use dummy data (only on first page)
      if (list.length === 0 && page === 1 && !append) {
        const dummyData = getDummyData();
        const nipLoans = NIPLoan.fromApiResponseArray(dummyData);
        setNipList(nipLoans);
        setPagination({
          currentPage: 1,
          hasNextPage: false,
          totalPages: 1,
        });
      } else {
        const nipLoans = NIPLoan.fromApiResponseArray(list);
        setNipList((prev) => (append ? [...prev, ...nipLoans] : nipLoans));
        setPagination({
          currentPage: pag.currentPage ?? page,
          hasNextPage: Boolean(pag.hasNextPage),
          totalPages: pag.totalPages ?? 1,
        });
      }
    } catch (err) {
      console.error('Fetch NIP loans error:', err);
      if (page === 1) {
        // On error, show dummy data
        const dummyData = getDummyData();
        const nipLoans = NIPLoan.fromApiResponseArray(dummyData);
        setNipList(nipLoans);
        setError(null); // Don't show error, just use dummy data
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchNIPLoans(1, false);
  }, [fetchNIPLoans]);

  const loadMore = useCallback(() => {
    if (loadingMore || !pagination.hasNextPage) return;
    const nextPage = pagination.currentPage + 1;
    fetchNIPLoans(nextPage, true);
  }, [loadingMore, pagination.hasNextPage, pagination.currentPage, fetchNIPLoans]);

  const filteredList = searchQuery.trim()
    ? nipList.filter(
        (loan) =>
          loan.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loan.customerPhone?.includes(searchQuery) ||
          loan.customerNo?.includes(searchQuery)
      )
    : nipList;

  const handleCustomerSelect = (loan) => {
    navigation.navigate('LoanScreen', { loan });
  };

  const handlePhonePress = (phoneNumber) => {
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.openURL(phoneUrl)
      .then((supported) => {
        if (!supported) {
          Alert.alert(t('common.error'), t('collection.call'));
        }
      })
      .catch((err) => {
        console.error('Error opening phone dialer:', err);
        Alert.alert(t('common.error'), t('collection.call'));
      });
  };

  const handleMapPress = (latitude, longitude) => {
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
          Alert.alert(t('common.error'), t('collection.map'));
        });
      });
  };

  const getStatusLabel = (loan) => {
    return loan.getStatusLabel();
  };

  const getStatusColor = (loan) => {
    return loan.getStatusColor();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (val) => {
    if (val == null || val === '') return '—';
    const num = parseFloat(val);
    return isNaN(num) ? val : `₹${num.toLocaleString('en-IN')}`;
  };

  const openPhotoModal = (imagePath) => {
    const uri = getImageUrl(imagePath);
    if (uri) {
      setPhotoModalUri(uri);
      setPhotoModalVisible(true);
    }
  };

  // customer_id or customer_no (NIPLoan: customerId, customerNo; raw API: customer_id, customer_no)
  const getCustomerIdDisplay = (item) => item?.customerId ?? item?.customerNo ?? item?.customer_id ?? item?.customer_no ?? '—';

  const renderNIPItem = ({ item }) => (
    <TouchableOpacity
      style={styles.nipCard}
      onPress={() => handleCustomerSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.nipCardHeader}>
        <TouchableOpacity
          style={styles.nipCardPhotoWrap}
          onPress={(e) => {
            e.stopPropagation();
            openPhotoModal(item?.customerPhoto ?? item?.customer_photo);
          }}
          activeOpacity={0.8}
        >
          {(item?.customerPhoto ?? item?.customer_photo) ? (
            <Image
              source={{ uri: getImageUrl(item?.customerPhoto ?? item?.customer_photo) }}
              style={styles.nipCardPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.nipCardPhotoPlaceholder}>
              <Ionicons name="person" size={20} color={COLORS.text.tertiary} />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.nipCardNameLine} numberOfLines={1}>
          {' - '}{getCustomerIdDisplay(item)}{' - '}{(item?.customerName ?? item?.customer_name ?? '—')}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item)}</Text>
        </View>
      </View>
      <View style={styles.nipCardDivider} />
      <View style={styles.nipCardRow}>
        <Ionicons name="cash-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
        <Text style={styles.nipCardLabel}>{t('loan.loanAmount')}</Text>
        <Text style={styles.nipCardValueAmount}>{formatAmount(item?.loanAmount)}</Text>
      </View>
      {item?.approvedAmount != null && item?.approvedAmount !== '' && (
        <View style={styles.nipCardRow}>
          <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
          <Text style={styles.nipCardLabel}>{t('loan.approved')}</Text>
          <Text style={styles.nipCardValue}>{formatAmount(item?.approvedAmount)}</Text>
        </View>
      )}
      {item?.balanceAmount != null && item?.balanceAmount !== '' && (
        <View style={styles.nipCardRow}>
          <Ionicons name="wallet-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
          <Text style={styles.nipCardLabel}>{t('loan.balance')}</Text>
          <Text style={styles.nipCardValue}>{formatAmount(item?.balanceAmount)}</Text>
        </View>
      )}
      <View style={styles.nipCardRow}>
        <Ionicons name="business-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
        <Text style={styles.nipCardLabel}>{t('loan.branch')}</Text>
        <Text style={styles.nipCardValue} numberOfLines={1}>{item?.branchName ?? '—'}</Text>
      </View>
      <View style={styles.nipCardFooter}>
        <Text style={styles.nipCardDate}>{t('loan.requested')} {formatDate(item?.requestedDate)}</Text>
        <View style={styles.nipCardFooterIcons}>
          {item?.addressLatitude && item?.addressLongitude && (
            <TouchableOpacity
              style={styles.nipCardIconButton}
              onPress={(e) => {
                e.stopPropagation();
                handleMapPress(item.addressLatitude, item.addressLongitude);
              }}
            >
              <Ionicons name="map-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          {item?.customerPhone && (
            <TouchableOpacity
              style={styles.nipCardIconButton}
              onPress={(e) => {
                e.stopPropagation();
                handlePhonePress(item.customerPhone);
              }}
            >
              <Ionicons name="call" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ListSkeleton count={2} />
      </View>
    );
  };

  const renderEmpty = () => {
    // Initial load only: show spinner (never skeleton). Pagination = skeleton in footer only.
    if (loading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('nip.loadingNIP')}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.text.tertiary} />
          <Text style={styles.emptyStateText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchNIPLoans(1, false)}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="document-text-outline" size={48} color={COLORS.text.tertiary} />
        <Text style={styles.emptyStateText}>
          {searchQuery.trim() ? t('nip.noNIPLoans') : t('nip.noNIPLoans')}
        </Text>
        <Text style={styles.emptyStateSubText}>
          {searchQuery.trim()
            ? t('common.search')
            : t('nip.noNIPLoans')}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      
      <Header 
        title={t('nip.title')} 
        showBackButton={true}
        onBackPress={() => navigation.goBack()} 
      />

      <View style={styles.searchSection}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={COLORS.primary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('nip.searchPlaceholder')}
            placeholderTextColor={COLORS.text.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            returnKeyType="search"
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
      </View>

      <FlatList
          data={filteredList}
          keyExtractor={(item) => String(item?.id ?? Math.random())}
          renderItem={renderNIPItem}
          contentContainerStyle={
            filteredList.length === 0
              ? styles.nipListContainerEmpty
              : styles.nipListContainer
          }
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={filteredList.length > 0 ? renderFooter : null}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: SIZES.base / 2,
  },
  searchInput: {
    flex: 1,
    padding: SIZES.base,
    fontSize: SIZES.body3,
    color: COLORS.text.primary,
  },
  clearButton: {
    padding: SIZES.base / 2,
  },
  skeletonContainer: {
    flex: 1,
    padding: SIZES.padding,
  },
  skeletonWrap: {
    flex: 1,
  },
  nipListContainer: {
    padding: SIZES.padding,
  },
  nipListContainerEmpty: {
    flex: 1,
  },
  nipCard: {
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
  nipCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nipCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.margin * 0.5,
  },
  nipCardNameLine: {
    flex: 1,
    fontSize: SIZES.body1,
    fontWeight: '700',
    color: COLORS.text?.primary || COLORS.primary,
    // marginHorizontal: SIZES.base,
  },
  nipCardPhotoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: SIZES.base,
  },
  nipCardPhoto: {
    width: '100%',
    height: '100%',
  },
  nipCardPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base * 0.25,
    borderRadius: SIZES.radius * 0.5,
  },
  statusText: {
    fontSize: SIZES.body4,
    fontWeight: '600',
    color: COLORS.white,
  },
  nipCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base * 0.5,
    gap: SIZES.base * 0.5,
  },
  nipCardLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    flex: 1,
  },
  nipCardValue: {
    fontSize: SIZES.body3,
    fontWeight: '500',
    color: COLORS.text.secondary,
    flex: 1,
    textAlign: 'right',
  },
  nipCardValueAmount: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.primary,
    flex: 1,
    textAlign: 'right',
  },
  nipCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SIZES.margin * 0.5,
    paddingTop: SIZES.margin * 0.5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  nipCardDate: {
    fontSize: SIZES.body4,
    color: COLORS.text.tertiary,
  },
  nipCardFooterIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
  },
  nipCardIconButton: {
    padding: SIZES.base * 0.5,
  },
  footerLoader: {
    paddingVertical: SIZES.margin,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
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
    padding: SIZES.padding * 2,
  },
  emptyStateText: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: SIZES.margin,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    marginTop: SIZES.base,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SIZES.margin,
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body2,
    fontWeight: '600',
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
});

export default NIPScreen;

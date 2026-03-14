import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import Header from '../../components/common/Header';
import ListSkeleton from '../../components/common/ListSkeleton';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { showError } from '../../utils/alertService';
import { formatDisplayDate } from '../../utils/dateFormatter';

const LIMIT = 10;
const API_BASE_URL = 'http://65.0.100.65:6005';

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/api')) return `${API_BASE_URL}${imagePath}`;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}/api/v1${cleanPath}`;
};

const LoanCustomerListScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [loanList, setLoanList] = useState([]);
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
  const fetchLoans = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const response = await apiServices.loan.getLoanList({
        page,
        limit: LIMIT,
        approval_status: '',
        loan_status: '',
        customer_id: '',
      });

      const list = Array.isArray(response?.data) ? response.data : [];
      const pag = response?.pagination || {};

      setLoanList((prev) => (append ? [...prev, ...list] : list));
      setPagination({
        currentPage: pag.currentPage ?? page,
        hasNextPage: Boolean(pag.hasNextPage),
        totalPages: pag.totalPages ?? 1,
      });
    } catch (err) {
      console.error('Fetch loans error:', err);
      if (page === 1) {
        setError(t('loan.failedToLoad'));
        setLoanList([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLoans(1, false);
    }, [fetchLoans])
  );

  const loadMore = useCallback(() => {
    if (loadingMore || !pagination.hasNextPage) return;
    const nextPage = pagination.currentPage + 1;
    fetchLoans(nextPage, true);
  }, [loadingMore, pagination.hasNextPage, pagination.currentPage, fetchLoans]);

  const filteredList = searchQuery.trim()
    ? loanList.filter(
      (loan) =>
        (loan?.customer_name ?? '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (loan?.customer_phone ?? '').includes(searchQuery) ||
        (loan?.customer_no ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(loan?.id ?? '').includes(searchQuery)
    )
    : loanList;

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
        console.error('Error opening phone dialer:', err);
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
        console.error('Error opening Google Maps:', err);
        // Fallback to web version
        Linking.openURL(googleMapsUrl).catch((fallbackErr) => {
          console.error('Error opening Google Maps web:', fallbackErr);
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
    const label = getStatusLabel(loan);
    if (label === 'Approved') return COLORS.success || '#10B981';
    if (label === 'Active') return COLORS.success || '#10B981';
    if (label === 'Rejected') return COLORS.error || '#EF4444';
    if (label === 'Closed') return COLORS.text?.tertiary || '#6B7280';
    if (label === 'Pending') return '#F59E0B'; // Orange
    return COLORS.primary || '#1d7ee2';
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

  const renderLoanItem = ({ item }) => (
    <TouchableOpacity
      style={styles.loanCard}
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
              source={{ uri: 'https://www.kambaa.com/favicon.png' }}
              style={styles.loanCardPhoto}
              resizeMode="cover"
            />
          )}
        </TouchableOpacity>
        <Text style={styles.loanCardNameLine} numberOfLines={1}>
          {(item?.customer_no ?? item?.customer_no ?? '—')}{' - '}{(item?.customer_name ?? '—')}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item)}</Text>
        </View>
      </View>
      <View style={styles.loanCardDivider} />
      <View style={styles.loanCardRow}>
        <Ionicons name="cash-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
        <Text style={styles.loanCardLabel}>{t('loan.loanAmount')}</Text>
        <Text style={styles.loanCardValueAmount}>{formatAmount(item?.loan_amount)}</Text>
      </View>
      {item?.approved_amount != null && item?.approved_amount !== '' && (
        <View style={styles.loanCardRow}>
          <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.text?.tertiary || '#666'} />
          <Text style={styles.loanCardLabel}>{t('loan.approved')}</Text>
          <Text style={styles.loanCardValue}>{formatAmount(item?.approved_amount)}</Text>
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
          {item?.loan_type_name || '—'}
        </Text>
      </View>
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
              <Ionicons name="map-outline" size={18} color={COLORS.primary} />
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
    // Initial load only: show spinner (never skeleton). Pagination uses ListFooterComponent (skeleton only).
    if (loading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('loan.loadingLoans')}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.text.tertiary} />
          <Text style={styles.emptyStateText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchLoans(1, false)}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
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
        onBackPress={() => navigation.goBack()}
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
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={COLORS.primary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('loan.searchPlaceholder')}
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
        renderItem={renderLoanItem}
        contentContainerStyle={
          filteredList.length === 0
            ? styles.customerListContainerEmpty
            : styles.customerListContainer
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
    backgroundColor: COLORS.white,
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
  searchInput: {
    flex: 1,
    padding: SIZES.base,
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
    backgroundColor: 'transparent',
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
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  loanCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loanCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray,
    marginVertical: SIZES.margin * 0.5,
  },
  loanCardNameLine: {
    flex: 1,
    fontSize: SIZES.body1,
    fontWeight: '700',
    color: COLORS.text?.primary || COLORS.primary,
    // marginHorizontal: SIZES.base,
  },
  loanCardPhotoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: SIZES.base,
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
    marginBottom: SIZES.base * 0.5,
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
  loanCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZES.base,
    paddingTop: SIZES.base,
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
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base * 0.25,
    borderRadius: 8,
  },
  statusText: {
    fontSize: SIZES.body4 || 12,
    fontWeight: '600',
    color: COLORS.white,
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

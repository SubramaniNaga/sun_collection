import { Ionicons } from '@expo/vector-icons';

import { useFocusEffect } from '@react-navigation/native';

import { StatusBar } from 'expo-status-bar';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,

  FlatList,

  Image,

  Keyboard,

  Linking,

  Modal,

  Platform,

  RefreshControl,

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
import { DEBOUNCE_MS_DEFAULT, useDebouncedValue } from '../../hooks/useDebouncedValue';

import NIPLoan from '../../models/NIPLoan';

import { useLanguage } from '../../store/LanguageContext';

import { getApiErrorMessage, showError } from '../../utils/alertService';
import { safeGoBack } from '../../utils/navigationHelpers';

import { formatCurrency } from '../../utils/amountFormatters';

import { formatDisplayDate } from '../../utils/dateFormatter';



const LIMIT = 20;

const API_BASE_URL = 'http://65.0.100.65:6005';



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

/** Ordered steps for “one level” font size changes on NIP screen */
const NIP_FONT_LADDER = [
  SIZES.body5,
  SIZES.body4,
  SIZES.body3,
  SIZES.body2,
  SIZES.body1,
  SIZES.h3,
  SIZES.h2,
];

function shiftNipFontSize(baseSize, language) {
  const idx = NIP_FONT_LADDER.indexOf(baseSize);
  if (idx === -1) return baseSize;
  const delta = language === 'ta' ? -1 : 1;
  const next = Math.max(0, Math.min(NIP_FONT_LADDER.length - 1, idx + delta));
  return NIP_FONT_LADDER[next];
}

const NIPScreen = ({ navigation }) => {

  const { t, language } = useLanguage();

  const styles = useMemo(() => createNipScreenStyles(language), [language]);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, DEBOUNCE_MS_DEFAULT);

  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);

  const headerSearchInputRef = useRef(null);

  const [nipTypeTab, setNipTypeTab] = useState(1);

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

  const [refreshing, setRefreshing] = useState(false);

  const isFirstFocusRef = useRef(true);

  const [nipTabCounts, setNipTabCounts] = useState({ nip1: 0, nip2: 0 });

  const countNipRowsForTab = useCallback((list, nipTypeForApi) => {
    if (!Array.isArray(list)) return 0;
    return list.filter(
      (row) => String(row.nip_type ?? '').toLowerCase() === nipTypeForApi,
    ).length;
  }, []);

  const fetchNipTabCounts = useCallback(async (search = debouncedSearchQuery) => {
    try {
      const trimmedSearch = search.trim();
      const response = await apiServices.loan.getNIPList({
        search: trimmedSearch,
        page: 1,
        limit: 500,
      });

      const list = Array.isArray(response?.data) ? response.data : [];
      setNipTabCounts({
        nip1: countNipRowsForTab(list, 'nip1'),
        nip2: countNipRowsForTab(list, 'nip2'),
      });
    } catch {
      // Keep existing counts if the count request fails.
    }
  }, [debouncedSearchQuery, countNipRowsForTab]);

  useEffect(() => {
    if (!headerSearchOpen) return undefined;
    const timer = setTimeout(() => {
      headerSearchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [headerSearchOpen]);

  const closeHeaderSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchQuery('');
    setHeaderSearchOpen(false);
  }, []);

  const handleNipTabChange = useCallback((tab) => {
    if (tab === nipTypeTab) return;
    setNipList([]);
    setLoading(true);
    setNipTypeTab(tab);
  }, [nipTypeTab]);

  const fetchNIPLoans = useCallback(async (page = 1, append = false, options = {}) => {

    const { skipFullScreenLoader = false } = options;

    const nipTypeForApi = nipTypeTab === 2 ? 'nip2' : 'nip1';

    try {

      if (page === 1 && !append && !skipFullScreenLoader) {

        setLoading(true);

        setError(null);

      } else if (page === 1 && !append && skipFullScreenLoader) {

        setError(null);

      } else {

        setLoadingMore(true);

      }



      const response = await apiServices.loan.getNIPList({

        search: debouncedSearchQuery.trim(),

        page,

        limit: LIMIT,

        nip_type: nipTypeForApi,

      });



      const list = Array.isArray(response?.data) ? response.data : [];

      const listForTab = list.filter(
        (row) => String(row.nip_type ?? '').toLowerCase() === nipTypeForApi,
      );

      const pag = response?.pagination || {};

      const nipLoans = NIPLoan.fromApiResponseArray(listForTab);

      setNipList((prev) => (append ? [...prev, ...nipLoans] : nipLoans));

      setPagination({

        currentPage: pag.currentPage ?? page,

        hasNextPage: Boolean(pag.hasNextPage),

        totalPages: pag.totalPages ?? 1,

      });

    } catch (err) {


      if (page === 1) {
        setNipList([]);
        setError(null);
        showError(t('common.error'), getApiErrorMessage(err, t('nip.failedToLoad')));
      }

    } finally {

      setLoading(false);

      setLoadingMore(false);

    }

  }, [debouncedSearchQuery, nipTypeTab, t]);



  const onRefresh = useCallback(async () => {

    setRefreshing(true);

    try {

      await Promise.all([
        fetchNIPLoans(1, false, { skipFullScreenLoader: true }),
        fetchNipTabCounts(debouncedSearchQuery),
      ]);

    } finally {

      setRefreshing(false);

    }

  }, [fetchNIPLoans, fetchNipTabCounts, debouncedSearchQuery]);

  useFocusEffect(
    useCallback(() => {
      const skipLoader = !isFirstFocusRef.current;
      isFirstFocusRef.current = false;
      fetchNIPLoans(1, false, { skipFullScreenLoader: skipLoader });
      fetchNipTabCounts(debouncedSearchQuery);
    }, [fetchNIPLoans, fetchNipTabCounts, debouncedSearchQuery]),
  );

  const loadMore = useCallback(() => {

    if (loadingMore || !pagination.hasNextPage) return;

    const nextPage = pagination.currentPage + 1;

    fetchNIPLoans(nextPage, true);

  }, [loadingMore, pagination.hasNextPage, pagination.currentPage, fetchNIPLoans]);

  const handleCustomerSelect = (loan) => {

    navigation.navigate('NIPCollectionDetails', { loan });

  };



  const handlePhonePress = (phoneNumber) => {

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


        Linking.openURL(googleMapsUrl).catch((fallbackErr) => {


          showError(t('common.error'), t('collection.map'));

        });

      });

  };



  const getStatusLabel = (loan) => {

    return loan.getStatusLabel();

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





  const openPhotoModal = (imagePath) => {

    const uri = getImageUrl(imagePath);

    if (uri) {

      setPhotoModalUri(uri);

      setPhotoModalVisible(true);

    }

  };



  const renderNIPItem = ({ item }) => {
    const customerName = String(item?.customerName ?? item?.customer_name ?? '').trim();
    const isLongCustomerName = customerName.length > 10;
    return (

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

            <Image

              source={require('../../../assets/images/favicon.png')}

              style={styles.nipCardPhoto}

              resizeMode="cover"

            />

          )}

        </TouchableOpacity>

        <View style={styles.nipCardHeaderBody}>

          {isLongCustomerName ? (
            <>
              <Text style={styles.nipCardNameLine} numberOfLines={2}>
                {(item?.customerNo ?? item?.customer_no ?? '—')}{' - '}{(item?.customerName ?? item?.customer_name ?? '—')}
              </Text>
              <View style={[styles.statusBadge, styles.statusBadgeBelowName, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.statusText, styles.statusTextRed]}>{getStatusLabel(item)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.nipCardNameRow}>
              <Text style={[styles.nipCardNameLine, styles.nipCardNameLineInline]} numberOfLines={1}>
                {(item?.customerNo ?? item?.customer_no ?? '—')}{' - '}{(item?.customerName ?? item?.customer_name ?? '—')}
              </Text>
              <View style={[styles.statusBadge, styles.statusBadgeInline, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.statusText, styles.statusTextRed]}>{getStatusLabel(item)}</Text>
              </View>
            </View>
          )}

        </View>

      </View>

      <View style={styles.nipCardDivider} />

      <View style={styles.nipCardRow}>

        <Ionicons name="cash-outline" size={16} color={COLORS.text?.tertiary || '#666'} />

        <Text style={styles.nipCardLabel}>{t('loan.loanAmount')}</Text>

        <Text style={styles.nipCardValueAmount}>{formatCurrency(item?.loanAmount)}</Text>

      </View>

      <View style={styles.nipCardRow}>

        <Ionicons name="pricetag-outline" size={16} color={COLORS.text?.tertiary || '#666'} />

        <Text style={styles.nipCardLabel}>{t('loan.interestAmount')}</Text>

        <Text style={styles.nipCardValue} numberOfLines={1}>

          {formatAmountOrDash(item?.intrestAmount ?? item?.intrest_amount)}

        </Text>

      </View>

      <View style={styles.nipCardRow}>

        <Ionicons name="trending-up-outline" size={16} color={COLORS.text?.tertiary || '#666'} />

        <Text style={styles.nipCardLabel}>{t('loan.processingFees')}</Text>

        <Text style={styles.nipCardValue} numberOfLines={1}>

          {formatAmountOrDash(item?.processingFees ?? item?.processing_fees)}

        </Text>

      </View>



      {item?.balanceAmount != null && item?.balanceAmount !== '' && (

        <View style={styles.nipCardRow}>

          <Ionicons name="wallet-outline" size={16} color={COLORS.text?.tertiary || '#666'} />

          <Text style={styles.nipCardLabel}>{t('loan.balance')}</Text>

          <Text style={styles.nipCardValue}>{formatCurrency(item?.balanceAmount)}</Text>

        </View>

      )}

      <View style={styles.nipCardRow}>

        <Ionicons name="business-outline" size={16} color={COLORS.text?.tertiary || '#666'} />

        <Text style={styles.nipCardLabel}>{t('loan.loanPeriod')}</Text>

        <Text style={styles.nipCardValue} numberOfLines={1}>

          {item?.loanPeriod ?? item?.loan_period ?? '—'}/{item?.loanTypeName ?? item?.loan_type_name ?? '—'}

        </Text>

      </View>

      <View style={styles.nipCardRow}>

        <Ionicons name="pie-chart-outline" size={16} color={COLORS.text?.tertiary || '#666'} />

        <Text style={styles.nipCardLabel}>{t('loan.loanDueStatus')}</Text>

        <Text style={styles.nipCardValue}>

          {item?.completed_count ?? 0}({item?.pending_count ?? 0})/{(item?.completed_count ?? 0) + (item?.pending_count ?? 0)}

        </Text>

      </View>



      <View style={styles.nipCardRow}>

        <Ionicons name="business-outline" size={16} color={COLORS.text?.tertiary || '#666'} />

        <Text style={styles.nipCardLabel}>{t('loan.branch')}</Text>

        <Text style={styles.nipCardValue} numberOfLines={1}>{item?.branchName ?? '—'}</Text>

      </View>

      <View style={styles.nipCardRow}>

        <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.text?.tertiary || '#666'} />

        <Text style={styles.nipCardLabel}>{t('nip.nipPaidTotal')}</Text>

        <Text style={styles.nipCardValuePaidTotal}>

          {formatAmountOrDash(item?.nipPaidTotal ?? item?.nip_paid_total)}

        </Text>

      </View>



      <View style={styles.nipCardFooter}>

        <Text style={styles.nipCardDate}>{t('loan.requested')} {formatDisplayDate(item?.requestedDate)}</Text>

        <View style={styles.nipCardFooterIcons}>

          {item?.addressLatitude && item?.addressLongitude && (

            <TouchableOpacity

              style={styles.nipCardIconButton}

              onPress={(e) => {

                e.stopPropagation();

                handleMapPress(item.addressLatitude, item.addressLongitude);

              }}

            >

              <Ionicons name="map-outline" size={18} color={COLORS.error} />

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

              <Ionicons name="call" size={18} color={COLORS.error} />

            </TouchableOpacity>

          )}

          <Ionicons name="chevron-forward" size={18} color={COLORS.error} />

        </View>

      </View>

    </TouchableOpacity>

  );
  };



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

    if (debouncedSearchQuery.trim() && nipList.length === 0) {

      return (

        <View style={styles.emptyState}>

          <Ionicons name="search-outline" size={48} color={COLORS.text.tertiary} />

          <Text style={styles.emptyStateText}>{t('nip.noSearchMatches')}</Text>

          <Text style={styles.emptyStateSubText}>{t('common.search')}</Text>

        </View>

      );

    }

    return (

      <View style={styles.emptyState}>

        <Ionicons name="document-text-outline" size={48} color={COLORS.text.tertiary} />

        <Text style={styles.emptyStateText}>{t('nip.noNIPLoans')}</Text>

        <Text style={styles.emptyStateSubText}>{t('nip.noNIPLoansHint')}</Text>

      </View>

    );

  };



  return (

    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>

      <StatusBar style="light" backgroundColor={COLORS.statusBar} />



      <Header

        title={t('nip.title')}

        showBackButton={true}

        onBackPress={() => safeGoBack(navigation)}

        searchExpanded={headerSearchOpen}

        searchExpandedContent={
          headerSearchOpen ? (
            <View style={styles.headerSearchRow}>
              <Ionicons name="search" size={18} color={COLORS.primary} style={styles.headerSearchIcon} />
              <View style={styles.headerSearchInputWrap}>
                <TextInput
                  ref={headerSearchInputRef}
                style={[styles.headerSearchInput, styles.headerSearchInputSized]}
                  placeholder={t('nip.searchPlaceholder')}
                  placeholderTextColor={COLORS.text.tertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  multiline={false}
                  numberOfLines={1}
                  scrollEnabled
                  underlineColorAndroid="transparent"
                />
              </View>
              <TouchableOpacity
                style={styles.headerSearchCloseBtn}
                onPress={closeHeaderSearch}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={22} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
          ) : null
        }

        rightComponent={(
          <TouchableOpacity
            style={styles.headerSearchIconButton}
            onPress={() => setHeaderSearchOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.search')}
          >
            <Ionicons name="search-outline" size={24} color={COLORS.white} />
          </TouchableOpacity>
        )}
      />

      <View style={styles.topSection}>

        <View style={styles.nipTabsRow}>

          <TouchableOpacity

            style={[styles.nipTab, nipTypeTab === 1 && styles.nipTabActive]}

            onPress={() => handleNipTabChange(1)}

            activeOpacity={0.7}

          >

            <Text
              style={[styles.nipTabText, nipTypeTab === 1 && styles.nipTabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >

              {t('nip.tabNIP1')} ({nipTabCounts.nip1})

            </Text>

          </TouchableOpacity>

          <TouchableOpacity

            style={[styles.nipTab, nipTypeTab === 2 && styles.nipTabActive]}

            onPress={() => handleNipTabChange(2)}

            activeOpacity={0.7}

          >

            <Text
              style={[styles.nipTabText, nipTypeTab === 2 && styles.nipTabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >

              {t('nip.tabNIP2')} ({nipTabCounts.nip2})

            </Text>

          </TouchableOpacity>

        </View>

      </View>



      <FlatList

        data={nipList}

        keyExtractor={(item) => String(item?.id ?? Math.random())}

        renderItem={renderNIPItem}

        contentContainerStyle={

          nipList.length === 0

            ? styles.nipListContainerEmpty

            : styles.nipListContainer

        }

        showsVerticalScrollIndicator={false}

        onEndReached={loadMore}

        onEndReachedThreshold={0.3}

        ListEmptyComponent={renderEmpty}

        ListFooterComponent={nipList.length > 0 ? renderFooter : null}

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

    </SafeAreaView>

  );

};



function createNipScreenStyles(language) {
  const font = (base) => shiftNipFontSize(base, language);

  return StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: COLORS.background,

  },

  topSection: {

    backgroundColor: COLORS.white,

    borderBottomWidth: 1,

    borderBottomColor: COLORS.border,

  },

  headerSearchRow: {

    flexDirection: 'row',

    flexWrap: 'nowrap',

    alignItems: 'center',

    backgroundColor: COLORS.white,

    borderRadius: SIZES.radius * 1.25,

    paddingHorizontal: SIZES.base,

    paddingVertical: Platform.OS === 'android' ? 2 : 4,

    borderWidth: 1,

    borderColor: 'rgba(255,255,255,0.35)',

    minHeight: 36,

  },

  headerSearchIcon: {

    marginRight: SIZES.base / 2,

    flexShrink: 0,

  },

  headerSearchInputWrap: {

    flex: 1,

    minWidth: 0,

    justifyContent: 'center',

  },

  headerSearchInput: {

    flexGrow: 1,

    width: '100%',

    minWidth: 0,

    paddingVertical: Platform.OS === 'android' ? 4 : 6,

    paddingHorizontal: 0,

    margin: 0,

    color: COLORS.black,

    ...(Platform.OS === 'android'

      ? { textAlignVertical: 'center', includeFontPadding: false }

      : {}),

  },

  headerSearchInputSized: {

    fontSize: font(SIZES.body3),

    lineHeight: Math.ceil(font(SIZES.body3) * 1.2),

    maxHeight:
      Platform.OS === 'android'
        ? Math.max(28, Math.round(font(SIZES.body3) * 2.55))
        : Math.max(32, Math.round(font(SIZES.body3) * 2.75)),

  },

  headerSearchIconButton: {

    width: 40,

    height: 40,

    justifyContent: 'center',

    alignItems: 'center',

  },

  headerSearchCloseBtn: {

    flexShrink: 0,

    justifyContent: 'center',

    alignItems: 'center',

    paddingLeft: SIZES.base / 2,

    marginLeft: SIZES.base / 2,

  },

  nipTabsRow: {

    flexDirection: 'row',

    paddingHorizontal: SIZES.padding,

    paddingTop: SIZES.base,

    paddingBottom: SIZES.base,

    gap: SIZES.base / 2,

  },

  nipTab: {

    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingVertical: SIZES.base,

    paddingHorizontal: SIZES.base,

    borderRadius: SIZES.radius * 0.75,

    backgroundColor: COLORS.lightGray,

    borderWidth: 1,

    borderColor: COLORS.border,

  },

  nipTabActive: {

    backgroundColor: COLORS.primary,

    borderColor: COLORS.primary,

  },

  nipTabText: {

    fontSize: font(SIZES.body3),

    fontWeight: '600',

    color: COLORS.text.secondary,

  },

  nipTabTextActive: {

    color: COLORS.white,

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

    borderColor: COLORS.error,

    shadowColor: COLORS.black,

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.05,

    shadowRadius: 3.84,

    elevation: 3,

  },

  nipCardHeader: {

    flexDirection: 'row',

    alignItems: 'center',

  },

  nipCardHeaderBody: {

    flex: 1,

    flexDirection: 'column',

    justifyContent: 'center',

    paddingRight: SIZES.base * 0.25,

  },

  nipCardDivider: {

    height: StyleSheet.hairlineWidth,

    backgroundColor: COLORS.gray,

    marginVertical: SIZES.base * 0.75,

  },

  nipCardNameLine: {

    fontSize: font(SIZES.body2),

    fontWeight: '700',

    color: COLORS.error,

    marginBottom: SIZES.base * 0.375,

    lineHeight: Math.round(font(SIZES.body2) * 1.25),

  },
  nipCardNameLineInline: {
    marginBottom: 0,
    flex: 1,
    marginRight: SIZES.base * 0.75,
  },
  nipCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  nipCardPhotoWrap: {

    width: 40,

    height: 40,

    borderRadius: 20,

    overflow: 'hidden',

    marginRight: SIZES.base * 0.75,

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

    fontSize: font(SIZES.body4),

    fontWeight: '600',

    color: COLORS.white,

  },

  statusTextRed: {

    color: COLORS.error,

  },

  nipCardRow: {

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: SIZES.base * 0.5,

    gap: SIZES.base * 0.5,

  },

  nipCardLabel: {

    fontSize: font(SIZES.body3),

    color: COLORS.text.tertiary,

    flex: 1,

  },

  nipCardValue: {

    fontSize: font(SIZES.body3),

    fontWeight: '500',

    color: COLORS.text.secondary,

    flex: 1,

    textAlign: 'right',

  },

  nipCardValueAmount: {

    fontSize: font(SIZES.body2),

    fontWeight: '600',

    color: COLORS.error,

    flex: 1,

    textAlign: 'right',

  },

  nipCardValuePaidTotal: {

    fontSize: font(SIZES.body2),

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

    fontSize: font(SIZES.body4),

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

    fontSize: font(SIZES.body2),

    color: COLORS.text.secondary,

  },

  emptyState: {

    flex: 1,

    justifyContent: 'center',

    alignItems: 'center',

    padding: SIZES.padding * 2,

  },

  emptyStateText: {

    fontSize: font(SIZES.body1),

    fontWeight: '600',

    color: COLORS.text.secondary,

    marginTop: SIZES.margin,

    textAlign: 'center',

  },

  emptyStateSubText: {

    fontSize: font(SIZES.body3),

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

    fontSize: font(SIZES.body2),

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

}

export default NIPScreen;


import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getImageUrl } from '../../api/apiClient';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import VoiceMicButton from '../../components/common/VoiceMicButton';
import { COLORS, SIZES } from '../../constants/theme';
import { DEBOUNCE_MS_DEFAULT } from '../../hooks/useDebouncedValue';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError } from '../../utils/alertService';
import { formatAmountPlain, formatCurrency } from '../../utils/amountFormatters';
import { safeGoBack } from '../../utils/navigationHelpers';

const PAGE_LIMIT = 20;

const parseDelayList = (response) => {
  const raw = response?.data?.collections ?? response?.collections;
  return Array.isArray(raw) ? raw : [];
};

const DelayCollectionScreen = ({ navigation, route }) => {
  const { t } = useLanguage();
  const [delayUnit, setDelayUnit] = useState(route?.params?.delayUnit === 'days' ? 'days' : 'weeks');
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    hasNextPage: false,
  });
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoModalUri, setPhotoModalUri] = useState(null);

  const searchTextRef = useRef(searchText);
  searchTextRef.current = searchText;
  const delayUnitRef = useRef(delayUnit);
  delayUnitRef.current = delayUnit;
  const loadMoreLockRef = useRef(false);
  const searchDebounceRef = useRef(null);

  const delayUnitLabel = delayUnit === 'days' ? t('collection.dailyTab') : t('collection.weeklyTab');

  const fetchList = useCallback(async (page = 1, append = false, searchQuery = '', skipLoader = false) => {
    try {
      if (page === 1 && !append && !skipLoader) {
        setLoading(true);
        loadMoreLockRef.current = false;
      }

      const searchTrimmed = String(searchQuery || '').trim();
      const response = await apiServices.collection.getDelayedCollections({
        page,
        limit: PAGE_LIMIT,
        delay_unit: delayUnitRef.current,
        ...(searchTrimmed ? { search: searchTrimmed } : {}),
      });

      const rows = parseDelayList(response);
      const pag = response?.pagination || {};
      setList((prev) => (append ? [...prev, ...rows] : rows));
      setPagination({
        currentPage: pag.currentPage ?? page,
        hasNextPage: Boolean(pag.hasNextPage),
      });
    } catch (err) {
      if (page === 1 && !append) {
        showError(t('common.error'), getApiErrorMessage(err, t('collection.failedToLoad')));
        setList([]);
      }
    } finally {
      if (page === 1 && !append) {
        setLoading(false);
        setRefreshing(false);
      } else {
        setLoadingMore(false);
        loadMoreLockRef.current = false;
      }
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      fetchList(1, false, searchTextRef.current);
    }, [fetchList, delayUnit])
  );

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
      fetchList(1, false, searchText);
    }, DEBOUNCE_MS_DEFAULT);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchText, fetchList]);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    fetchList(1, false, searchTextRef.current, true);
  }, [refreshing, fetchList]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || loadMoreLockRef.current || !pagination.hasNextPage) return;
    loadMoreLockRef.current = true;
    setLoadingMore(true);
    fetchList(pagination.currentPage + 1, true, searchTextRef.current);
  }, [loading, loadingMore, pagination, fetchList]);

  const handleDelayUnitChange = (unit) => {
    setShowUnitDropdown(false);
    if (unit === delayUnit) return;
    setDelayUnit(unit);
  };

  const handlePhonePress = (phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      showError(t('common.error'), t('collection.call'));
    });
  };

  const handleMapPress = (address) => {
    if (!address || !String(address).trim()) {
      showError(t('common.error'), t('collection.map'));
      return;
    }
    const encodedAddress = encodeURIComponent(String(address).trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`).catch(() => {
      showError(t('common.error'), t('collection.map'));
    });
  };

  const handleLoanInfoPress = (item) => {
    const loanId = item?.loan_id;
    if (!loanId) return;
    navigation.navigate('LoanScreen', {
      loan: { id: loanId },
      customerData: {
        name: item?.customer_name ?? '',
        phone: item?.customer_phone ?? '',
        loanId: String(loanId),
        initialAmount: formatAmountPlain(item?.loan_amount),
      },
    });
  };

  const openPhotoModal = (imagePath) => {
    const uri = getImageUrl(imagePath);
    if (uri) {
      setPhotoModalUri(uri);
      setPhotoModalVisible(true);
    }
  };

  const formatBalance = (value) => {
    if (value == null || value === '') return '—';
    return formatCurrency(String(value));
  };

  const renderActionIcons = (item) => (
    <View style={styles.collectionCardIconsRow}>
      <TouchableOpacity
        style={styles.collectionCardIconButton}
        onPress={() => handleMapPress(item?.customer_address)}
      >
        <Ionicons name="map-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.collectionCardIconButton}
        onPress={() => handlePhonePress(item?.customer_phone)}
      >
        <Ionicons name="call" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.collectionCardIconButton}
        onPress={() => handleLoanInfoPress(item)}
      >
        <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }) => {
    const customerName = String(item?.customer_name ?? '').trim();
    const displayId = item?.customer_no ?? item?.customer_id ?? '—';
    const unpaidValue = delayUnit === 'days' ? item?.unpaid_days : item?.unpaid_weeks;
    const unpaidLabel = delayUnit === 'days' ? t('collection.unpaidDays') : t('collection.unpaidWeeks');

    return (
      <View style={styles.listItem}>
        <View style={styles.collectionCardHeader}>
          <TouchableOpacity
            style={styles.collectionCardPhotoWrap}
            onPress={() => openPhotoModal(item?.customer_photo)}
            activeOpacity={0.8}
          >
            {item?.customer_photo ? (
              <Image
                source={{ uri: getImageUrl(item.customer_photo) }}
                style={styles.collectionCardPhoto}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={require('../../../assets/images/favicon.png')}
                style={styles.collectionCardPhoto}
                resizeMode="cover"
              />
            )}
          </TouchableOpacity>
          <View style={styles.collectionCardHeaderBody}>
            <View style={styles.collectionCardNameRow}>
              <Text
                style={[styles.collectionCardNameLine, styles.collectionCardNameLineInline]}
                numberOfLines={2}
              >
                {displayId} - {customerName || '—'}
              </Text>
              {renderActionIcons(item)}
            </View>
            <View style={styles.itemMetaRow}>
              <View style={styles.itemMetaGroup}>
                <Text style={styles.itemMetaLeft}>{t('loan.balance')}:</Text>
                <Text style={styles.itemMetaRight}>{formatBalance(item?.balance_amount)}</Text>
              </View>
              <View style={styles.itemMetaGroup}>
                <Text style={styles.itemMetaLeft}>{unpaidLabel}:</Text>
                <Text style={styles.itemMetaRight}>{unpaidValue ?? '—'}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header
        title={t('collection.delayedTitle')}
        showBackButton
        onBackPress={() => safeGoBack(navigation)}
      />

      <View style={styles.content}>
        <View style={styles.filtersSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.text.tertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('common.search')}
                placeholderTextColor={COLORS.text.tertiary}
                value={searchText}
                onChangeText={setSearchText}
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
              />
              <VoiceMicButton value={searchText} onChangeText={setSearchText} />
            </View>
            <Pressable style={styles.unitDropdown} onPress={() => setShowUnitDropdown(true)}>
              <Text style={styles.unitDropdownText} numberOfLines={1}>
                {delayUnitLabel}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('collection.loadingCollections')}</Text>
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item, index) => `d-${item.loan_id || item.customer_id || index}`}
            renderItem={renderItem}
            contentContainerStyle={[styles.flatListContent, list.length === 0 && styles.flatListContentGrow]}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>{t('collection.noDelayedCollections')}</Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={styles.footerLoader} size="small" color={COLORS.primary} />
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
          />
        )}
      </View>

      <Modal
        visible={showUnitDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitDropdown(false)}
      >
        <Pressable style={styles.dropdownOverlay} onPress={() => setShowUnitDropdown(false)}>
          <View style={styles.dropdownSheet}>
            <Pressable
              style={[styles.dropdownOption, delayUnit === 'weeks' && styles.dropdownOptionActive]}
              onPress={() => handleDelayUnitChange('weeks')}
            >
              <Text style={[styles.dropdownOptionText, delayUnit === 'weeks' && styles.dropdownOptionTextActive]}>
                {t('collection.weeklyTab')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.dropdownOption, delayUnit === 'days' && styles.dropdownOptionActive]}
              onPress={() => handleDelayUnitChange('days')}
            >
              <Text style={[styles.dropdownOptionText, delayUnit === 'days' && styles.dropdownOptionTextActive]}>
                {t('collection.dailyTab')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
              <Image source={{ uri: photoModalUri }} style={styles.photoModalImage} resizeMode="contain" />
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1 },
  filtersSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.base,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    height: 44,
  },
  searchIcon: {
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.black,
    height: 44,
  },
  unitDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
    minWidth: 118,
    gap: SIZES.base / 2,
  },
  unitDropdownText: {
    fontSize: SIZES.body3,
    color: COLORS.black,
    fontWeight: '600',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    paddingTop: 110,
    paddingHorizontal: SIZES.padding,
    alignItems: 'flex-end',
  },
  dropdownSheet: {
    width: 160,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dropdownOptionActive: {
    backgroundColor: COLORS.lightGray,
  },
  dropdownOptionText: {
    fontSize: SIZES.body3,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  dropdownOptionTextActive: {
    color: COLORS.primary,
  },
  flatListContent: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  flatListContentGrow: { flexGrow: 1 },
  listItem: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    marginBottom: SIZES.base / 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  collectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  collectionCardHeaderBody: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  collectionCardPhotoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: SIZES.base,
    backgroundColor: COLORS.lightGray,
  },
  collectionCardPhoto: {
    width: '100%',
    height: '100%',
  },
  collectionCardNameLine: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.black,
    lineHeight: Math.round((SIZES.body1 || 16) * 1.25),
  },
  collectionCardNameLineInline: {
    flex: 1,
    minWidth: 0,
    marginRight: SIZES.base / 2,
  },
  collectionCardNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: SIZES.base / 2,
  },
  collectionCardIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: SIZES.base / 2,
  },
  collectionCardIconButton: {
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.base / 2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SIZES.base,
  },
  itemMetaGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemRowBalance: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: SIZES.base / 2,
    minHeight: 24,
  },
  itemRowLast: {
    marginBottom: 0,
  },
  itemMetaLeft: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
  },
  itemMetaRight: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginLeft: SIZES.base / 2,
    flexShrink: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  loadingText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
  },
  emptyText: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: SIZES.padding,
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

export default DelayCollectionScreen;

import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';

const SEARCH_DEBOUNCE_MS = 400;

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
  const [collectionData, setCollectionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const searchDebounceRef = useRef(null);

  const fetchCollectionData = useCallback(async (customerPhone = '') => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiServices.collection.getCollectionList({
        customer_phone: customerPhone.trim() || undefined,
      });
      const raw = response?.response ?? response?.data ?? response?.data?.response;
      const list = Array.isArray(raw) ? raw : [];
      setCollectionData(list);
    } catch (err) {
      console.error('Failed to fetch collection data:', err);
      setError('Failed to load collection data. Please check your connection and try again.');
      setCollectionData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load when screen is focused (initial load and when returning from CollectionDetails so list shows updated data)
  useFocusEffect(
    useCallback(() => {
      fetchCollectionData(searchText);
    }, [fetchCollectionData, searchText])
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
      fetchCollectionData(searchText);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchText, fetchCollectionData]);

  const filteredData = Array.isArray(collectionData) ? collectionData : [];

  const handleItemPress = (item) => {
    navigation.navigate('CollectionDetails', { item });
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" backgroundColor={COLORS.primary} />
      <Header
        title="Collection"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
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

        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.centerContainer}>
              <Text style={styles.loadingText}>Loading collection data...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => fetchCollectionData('')}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredData.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No collections found</Text>
            </View>
          ) : (
            filteredData.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.listItem}
              onPress={() => handleItemPress(item)}
            >
              <View style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>{item.customer_name ?? '—'}</Text>
                <TouchableOpacity
                  style={styles.inlineIconButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (item.customer_phone) handlePhonePress(item.customer_phone);
                  }}
                >
                  <Ionicons name="call" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.itemRow}>
                <Text style={styles.itemAssets}>Week {item.collection_week} · {formatDate(item.collection_date)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (item.amount_paid != null && Number(item.amount_paid) > 0) ? '#4CAF50' : '#FF9800' }]}>
                  <Text style={styles.statusText}>{(item.amount_paid != null && Number(item.amount_paid) > 0) ? 'Paid' : 'Pending'}</Text>
                </View>
              </View>
              <View style={[styles.itemRow, styles.itemRowLast]}>
                <Text style={styles.itemMetaLeft}>Paid: {formatAmount(item.amount_paid)}</Text>
                <Text style={styles.itemMetaRight}>Balance: {formatAmount(item.balance_amount)}</Text>
              </View>
              {/* {item.locality ? <Text style={styles.itemLocality} numberOfLines={1}>{item.locality}</Text> : null} */}
            </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    marginBottom: SIZES.margin,
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
});

export default CollectionScreen;

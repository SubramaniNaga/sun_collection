import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';

const CollectionScreen = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [collectionData, setCollectionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCollectionData();
  }, []);

  const fetchCollectionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiServices.collection.getCollectionList();
      setCollectionData(response.data || []);
    } catch (err) {
      console.error('Failed to fetch collection data:', err);
      setError('Failed to load collection data. Please check your connection and try again.');
      setCollectionData([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = collectionData.filter(item =>
    item.name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.accountNo.toLowerCase().includes(searchText.toLowerCase()) ||
    item.phone.includes(searchText) ||
    item.vehicleNo.toLowerCase().includes(searchText.toLowerCase())
  );

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

  const handleLocationPress = (latitude, longitude, name) => {
    const locationUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.canOpenURL(locationUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(locationUrl);
        } else {
          Alert.alert('Error', 'Maps not available');
        }
      })
      .catch((err) => console.error('Error opening maps:', err));
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
            placeholder="Search..."
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
              <TouchableOpacity style={styles.retryButton} onPress={fetchCollectionData}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredData.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No collection data found</Text>
            </View>
          ) : (
            filteredData.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.listItem}
              onPress={() => handleItemPress(item)}
            >
              {/* First Row: Name | Acc No | Phone Icon */}
              <View style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemAccount}>{item.accountNo}</Text>
                <TouchableOpacity
                  style={styles.inlineIconButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePhonePress(item.phone);
                  }}
                >
                  <Ionicons name="call" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
          
              {/* Second Row: Assets | Status | Location Icon */}
              <View style={styles.itemRow}>
                <Text style={styles.itemAssets}>Assets: {item.assets}</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: item.arrearStatus === 'Clear' ? '#4CAF50' : '#FF9800' }
                ]}>
                  <Text style={styles.statusText}>{item.arrearStatus}</Text>
                </View>
                <TouchableOpacity
                  style={styles.inlineIconButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleLocationPress(item.latitude, item.longitude, item.name);
                  }}
                >
                  <Ionicons name="location" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
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
    padding: SIZES.padding,
    marginBottom: SIZES.base,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base / 2,
  },
  itemName: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
  },
  itemAccount: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
   
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius / 2,
    flex: 1,
    textAlign: 'center',
  },
  inlineIconButton: {
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    width: 35,
    height: 35,
  },
  itemAssets: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius / 2,
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

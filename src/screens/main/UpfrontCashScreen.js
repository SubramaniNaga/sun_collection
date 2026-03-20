import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { formatCurrency } from '../../utils/amountFormatters';
import { formatDisplayDate } from '../../utils/dateFormatter';

const UpfrontCashScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiServices.upfrontCash.getUpfrontCashList({
        page: 1,
        limit: 20,
      });

      const data = response?.data ?? response?.response ?? [];
      setList(Array.isArray(data) ? data : []);

    } catch (error) {
      console.error('Upfront cash fetch error:', error);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <View style={[styles.tableHeaderCell, styles.idCell]}>
        <Text style={styles.tableHeaderText}>{t('upfrontCash.entryId')}</Text>
      </View>
      <View style={[styles.tableHeaderCell]}>
        <Text style={styles.tableHeaderText}>{t('upfrontCash.date')}</Text>
      </View>
      <View style={styles.tableHeaderCell}>
        <Text style={styles.tableHeaderText}>{t('upfrontCash.amount')}</Text>
      </View>
      <View style={styles.tableHeaderCell}>
        <Text style={styles.tableHeaderText}>{t('upfrontCash.remarks')}</Text>
      </View>

    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.tableRow}>
      <View style={[styles.tableCell, styles.idCell]}>
        <Text style={styles.tableRowText}>#{item.id}</Text>
        {/* <View style={[styles.statusBadge, item.send_by === 1 && styles.statusSettled]}>
          <Text style={styles.statusText}>
            {item.send_by === 1 ? t('upfrontCash.statusSettled') : t('upfrontCash.statusActive')}
          </Text>
        </View> */}
      </View>
      <View style={[styles.tableCell]}>
        {/* <Text style={styles.tableLabel}>{t('upfrontCash.date')}</Text> */}
        <Text style={styles.tableValue}>{formatDisplayDate(item.created_date)}</Text>
      </View>
      <View style={styles.tableCell}>
        {/* <Text style={styles.tableLabel}>{t('upfrontCash.amount')}</Text> */}
        <Text style={styles.tableValue}>{formatCurrency(item.amount)}</Text>
      </View>
      <View style={styles.tableCell}>
        {/* <Text style={styles.tableLabel}>{t('upfrontCash.remarks')}</Text> */}
        <Text style={styles.tableValue} numberOfLines={2}>{item.message || '—'}</Text>
      </View>

    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('upfrontCash.loadingUpfrontCash')}</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="wallet-outline" size={48} color={COLORS.text.tertiary} />
        <Text style={styles.emptyStateText}>{t('upfrontCash.noUpfrontCash')}</Text>
        <Text style={styles.emptyStateSubText}>{t('upfrontCash.tapToAdd')}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header
        title={t('upfrontCash.title')}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />
      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id ?? item.entryId ?? Math.random())}
        renderItem={renderItem}
        ListHeaderComponent={list.length > 0 ? renderTableHeader : null}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={list.length === 0 ? styles.listEmpty : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerAddButton: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 0,
    paddingBottom: SIZES.padding,
  },
  listEmpty: {
    flexGrow: 1,
    paddingBottom: SIZES.padding,
  },
  tableHeader: {
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    marginHorizontal: 0,
    marginTop: SIZES.margin,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableHeaderCell: {
    flex: 1,
    padding: SIZES.base,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  idCell: {
    flex: 0.5,
  },
  tableHeaderCellLast: {
    borderRightWidth: 0,
  },
  tableRow: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    marginHorizontal: 0,
    marginVertical: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  tableCell: {
    flex: 1,
    padding: SIZES.base,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    justifyContent: 'center',
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  tableHeaderText: {
    fontSize: SIZES.body3,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SIZES.base / 2,
  },
  tableRowText: {
    fontSize: SIZES.body4,
    fontWeight: '700',
    color: COLORS.black,
  },
  tableLabel: {
    fontSize: SIZES.body3,
    color: COLORS.black,
    marginBottom: SIZES.base / 4,
  },
  tableValue: {
    fontSize: SIZES.body4,
    fontWeight: '600',
    color: COLORS.black,
  },
  statusBadge: {
    paddingHorizontal: SIZES.base / 2,
    paddingVertical: SIZES.base / 4,
    borderRadius: SIZES.radius / 2,
    backgroundColor: COLORS.text.tertiary,
    alignSelf: 'flex-start',
  },
  statusSettled: {
    backgroundColor: COLORS.success,
  },
  statusText: {
    fontSize: SIZES.body4,
    fontWeight: '600',
    color: COLORS.white,
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
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: SIZES.margin,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: SIZES.body2,
    color: COLORS.primary,
    marginTop: SIZES.base,
    textAlign: 'center',
  },
});

export default UpfrontCashScreen;

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../../components/common/Card';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';

const formatAmount = (val) => {
  if (val == null || val === '') return '—';
  const n = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(n) ? String(val) : `₹${n.toLocaleString('en-IN')}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

const purposeLabel = (value) => {
  const map = {
    field_collection_float: 'Field Collection Float',
    customer_refund_handling: 'Customer Refund',
    petty_expenses: 'Petty Expenses',
    emergency_requirement: 'Emergency',
    other: 'Other',
  };
  return map[value] || value || '—';
};

const UpfrontCashScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [floatSummary, setFloatSummary] = useState({
    previousFloatBalance: 0,
    totalUpfrontCashTaken: 0,
    totalSettled: 0,
    currentOutstandingFloat: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Replace with API when available
      // const [listRes, summaryRes] = await Promise.all([
      //   apiClient.get('/upfront-cash/list'),
      //   apiClient.get('/wallet/float-summary'),
      // ]);
      // setList(listRes.data?.response ?? listRes.data ?? []);
      // setFloatSummary(summaryRes.data ?? {});

      setList([
        { id: 1, entryId: 'UC001', amountTaken: 2000, purpose: 'field_collection_float', cashReceivedFrom: 'manager', date: new Date().toISOString(), status: 'ACTIVE' },
        { id: 2, entryId: 'UC002', amountTaken: 1500, purpose: 'petty_expenses', cashReceivedFrom: 'accountant', date: new Date(Date.now() - 86400000).toISOString(), status: 'SETTLED' },
      ]);
      setFloatSummary({
        previousFloatBalance: 5000,
        totalUpfrontCashTaken: 2000,
        totalSettled: 1500,
        currentOutstandingFloat: 5500,
      });
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

  const handleAddPress = () => {
    navigation.navigate('UpfrontCashAdd');
  };

  const renderItem = ({ item }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.entryId}>{item.entryId || `#${item.id}`}</Text>
        <View style={[styles.statusBadge, item.status === 'SETTLED' && styles.statusSettled]}>
          <Text style={styles.statusText}>{item.status || 'ACTIVE'}</Text>
        </View>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>{t('common.amount')}</Text>
        <Text style={styles.value}>{formatAmount(item.amountTaken)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>{t('upfrontCash.purpose')}</Text>
        <Text style={styles.value}>{purposeLabel(item.purpose)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>{t('common.date')}</Text>
        <Text style={styles.value}>{formatDate(item.date)}</Text>
      </View>
    </Card>
  );

  const renderFloatSummary = () => (
    <Card style={styles.summaryCard}>
      <Text style={styles.sectionTitle}>{t('upfrontCash.floatSummary')}</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('upfrontCash.previousFloat')}</Text>
          <Text style={styles.summaryValue}>{formatAmount(floatSummary.previousFloatBalance)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('upfrontCash.totalUpfrontCash')}</Text>
          <Text style={styles.summaryValue}>{formatAmount(floatSummary.totalUpfrontCashTaken)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('upfrontCash.settled')}</Text>
          <Text style={styles.summaryValue}>{formatAmount(floatSummary.totalSettled)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('upfrontCash.outstanding')}</Text>
          <Text style={[styles.summaryValue, styles.outstanding]}>{formatAmount(floatSummary.currentOutstandingFloat)}</Text>
        </View>
      </View>
    </Card>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
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
        rightComponent={
          <TouchableOpacity onPress={handleAddPress} style={styles.headerAddButton} activeOpacity={0.7}>
            <Ionicons name="add" size={24} color={COLORS.white} />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id ?? item.entryId ?? Math.random())}
        renderItem={renderItem}
        ListHeaderComponent={list.length > 0 ? renderFloatSummary : null}
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
    backgroundColor: COLORS.white,
  },
  headerAddButton: {
    padding: SIZES.padding / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  listEmpty: {
    flexGrow: 1,
    paddingBottom: SIZES.padding,
  },
  summaryCard: {
    marginBottom: SIZES.margin,
  },
  sectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.margin,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    marginBottom: SIZES.margin,
    padding: SIZES.padding,
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
  },
  summaryLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 2,
  },
  summaryValue: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  outstanding: {
    color: COLORS.primary,
  },
  card: {
    marginBottom: SIZES.margin,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.margin * 0.75,
    paddingBottom: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  entryId: {
    fontSize: SIZES.body1,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  statusBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
  },
  statusSettled: {
    backgroundColor: COLORS.success + '20',
  },
  statusText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base * 0.5,
  },
  label: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    width: 80,
  },
  value: {
    fontSize: SIZES.body2,
    fontWeight: '500',
    color: COLORS.text.primary,
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
});

export default UpfrontCashScreen;

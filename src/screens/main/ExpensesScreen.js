import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import ListSkeleton from '../../components/common/ListSkeleton';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { formatDisplayDate } from '../../utils/dateFormatter';
import { formatCurrency } from '../../utils/amountFormatters';

const LIMIT = 10;

// Pending: #F59E0B, Approved: #10B981, Rejected: #EF4444 Process: #FFC107 #17a2b8
const STATUS_CONFIG = {
  '0': { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7' },
  '1': { label: 'Approved', color: '#10B981', bg: '#D1FAE5' },
  '2': { label: 'Rejected', color: '#EF4444', bg: '#FEE2E2' },
};




const ExpensesScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    hasNextPage: false,
    totalPages: 1,
  });
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const filterOptions = [
    t('common.all'),
    t('expenses.pending'),
    t('expenses.process'),
    t('expenses.approved'),
  ];

  const fetchExpenses = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const result = await apiServices.expense.getList({ page, limit: LIMIT });
      const list = Array.isArray(result?.data) ? result.data : [];
      const pag = result?.pagination || {};

      setExpenses((prev) => (append ? [...prev, ...list] : list));
      setPagination({
        currentPage: pag.currentPage ?? page,
        hasNextPage: Boolean(pag.hasNextPage),
        totalPages: pag.totalPages ?? 1,
      });
    } catch (err) {
      console.error('Fetch expenses error:', err);
      if (page === 1) {
        setError(t('expenses.noExpensesFound'));
        setExpenses([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      fetchExpenses(1, false);
    }, [fetchExpenses])
  );

  const loadMore = useCallback(() => {
    if (loadingMore || !pagination.hasNextPage) return;
    fetchExpenses(pagination.currentPage + 1, true);
  }, [loadingMore, pagination.hasNextPage, pagination.currentPage, fetchExpenses]);

  const filteredExpenses = (() => {
    if (selectedFilter === t('common.all')) return expenses;
    const statusMap = {
      [t('expenses.pending')]: ['0', 'Pending'],
      [t('expenses.process')]: ['2', 'Process'],
      [t('expenses.approved')]: ['1', 'Approved'],
    };
    const allowed = statusMap[selectedFilter] || [];
    return expenses.filter((e) => allowed.includes(String(e.status)));
  })();

  const handleFilterSelect = (filter) => {
    setSelectedFilter(filter);
    setShowFilterModal(false);
  };

  const getStatusColor = (status) => {
    const s = String(status ?? '');
    if (s === '1' || s === 'Approved') return COLORS.success || '#28a745';
    if (s === '2' || s === 'Process') return COLORS.warning || '#ffc107';
    return COLORS.info || '#17a2b8';
  };

  const renderExpenseItem = ({ item }) => {
    const dateVal = item.expense_date ?? item.date;
    const amountVal = item.amount ?? 0;
    const statusLabel = item.status != null ? String(item.status) : 'Pending';
    const status = STATUS_CONFIG[item.status] || { label: 'Unknown', color: '#6B7280', bg: '#E5E7EB' };

    return (
      <View style={styles.expenseCard}>
        <View style={styles.expenseGrid}>
          {/* Top Row: Title and Date */}
          <View style={styles.expenseTopRow}>
            <View style={styles.expenseTitleContainer}>
              <Text style={styles.expenseTitle} numberOfLines={1}>{item.title ?? '—'}</Text>
            </View>
            <View style={styles.expenseDateContainer}>
              <Text style={styles.dateText}>{formatDisplayDate(dateVal)}</Text>
            </View>
          </View>
          
          {/* Bottom Row: Status and Amount */}
          <View style={styles.expenseBottomRow}>
            <View style={styles.expenseStatusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>
            <View style={styles.expenseAmountContainer}>
              <Text style={styles.amountText}>{formatCurrency(amountVal)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderFilterOption = (option) => (
    <TouchableOpacity
      key={option}
      style={[
        styles.filterOption,
        selectedFilter === option && styles.selectedFilterOption,
      ]}
      onPress={() => handleFilterSelect(option)}
    >
      <Text style={[
        styles.filterOptionText,
        selectedFilter === option && styles.selectedFilterOptionText,
      ]}>
        {option}
      </Text>
      {selectedFilter === option && (
        <Ionicons name="checkmark" size={16} color={COLORS.primary} />
      )}
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
    // Initial load only: spinner (never skeleton). Pagination = skeleton in footer only.
    if (loading) {
      return (
        <View style={styles.initialLoaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.text.tertiary} />
          <Text style={styles.emptyStateText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchExpenses(1, false)}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={64} color={COLORS.text.tertiary} />
        <Text style={styles.emptyStateText}>{t('expenses.noExpensesFound')}</Text>
        <Text style={styles.emptyStateSubtext}>
          {selectedFilter === t('common.all')
            ? t('expenses.addFirstExpense')
            : t('expenses.noFilteredExpenses', { filter: selectedFilter })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('expenses.title')}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter-outline" size={24} color={COLORS.white} />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        <FlatList
          data={filteredExpenses}
          renderItem={renderExpenseItem}
          keyExtractor={(item) => String(item?.id ?? Math.random())}
          contentContainerStyle={
            filteredExpenses.length === 0 ? styles.listContainerEmpty : styles.listContainer
          }
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={filteredExpenses.length > 0 ? renderFooter : null}
        />
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ExpenseAdd')}
      >
        <Ionicons name="add" size={24} color={COLORS.white} />
      </TouchableOpacity>

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.filterModal}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>{t('expenses.filterExpenses')}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Ionicons name="close" size={20} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.filterOptionsContainer}>
              {filterOptions.map(renderFilterOption)}
            </ScrollView>
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
  content: {
    flex: 1,
  },
  filterButton: {
    padding: SIZES.padding / 2,
  },
  listContainer: {
    padding: SIZES.padding,
    paddingTop: SIZES.padding * 0.75,
  },
  listContainerEmpty: {
    flexGrow: 1,
    padding: SIZES.padding,
  },
  initialLoaderWrap: {
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
  footerLoader: {
    paddingVertical: SIZES.padding,
  },
  expenseCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 0.75,
    marginBottom: SIZES.margin * 0.4,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  expenseGrid: {
    flex: 1,
  },
  expenseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base * 0.5,
  },
  expenseBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseTitleContainer: {
    flex: 1,
    marginRight: SIZES.base,
  },
  expenseDateContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  expenseStatusContainer: {
    flex: 1,
    marginRight: SIZES.base,
  },
  expenseAmountContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  expenseTitle: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  expenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
  },
  dateText: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
  },
  amountText: {
    fontSize: SIZES.body2,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
  },
  emptyStateText: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: SIZES.margin,
  },
  emptyStateSubtext: {
    fontSize: SIZES.body2,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginTop: SIZES.base,
  },
  retryButton: {
    marginTop: SIZES.margin,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: SIZES.padding * 4,
    right: SIZES.padding * 2,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModal: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    width: '80%',
    maxWidth: 300,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterModalTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  closeButton: {
    padding: SIZES.base / 2,
  },
  filterOptionsContainer: {
    paddingVertical: SIZES.base,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
  },
  selectedFilterOption: {
    backgroundColor: COLORS.lightGray,
  },
  filterOptionText: {
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
  },
  selectedFilterOptionText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: SIZES.base * 0.25,
    paddingHorizontal: SIZES.base,
    borderRadius: SIZES.radius,
    alignSelf: 'flex-start',
  },
});

export default ExpensesScreen;

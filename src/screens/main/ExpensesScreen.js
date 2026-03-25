import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { formatCurrency } from '../../utils/amountFormatters';
import { formatDisplayDate, getCurrentDateString } from '../../utils/dateFormatter';

const isToday = (dateVal) => {
  if (dateVal == null || dateVal === '') return false;
  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (Number.isNaN(d.getTime())) return false;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` === getCurrentDateString();
  } catch {
    return false;
  }
};

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
  const [deletingId, setDeletingId] = useState(null);
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

  const handleDeleteExpense = useCallback(
    (expense) => {
      const expenseId = expense?.id;
      if (expenseId == null || expenseId === '') {
        Alert.alert(t('common.error'), t('errors.somethingWentWrong'));
        return;
      }

      Alert.alert(
        t('common.delete'),
        'Are you sure you want to delete this expense?',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              setDeletingId(expenseId);
              try {
                await apiServices.expense.deleteExpense(expenseId);
                await fetchExpenses(1, false);
                Alert.alert(t('common.success'), t('success.deleted'));
              } catch (err) {
                console.error('Delete expense error:', err);
                Alert.alert(t('common.error'), err?.message || t('errors.somethingWentWrong'));
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
        { cancelable: true }
      );
    },
    [t, fetchExpenses]
  );

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
    const status = STATUS_CONFIG[item.status] || { label: 'Unknown', color: '#6B7280', bg: '#E5E7EB' };
    const expenseId = item?.id;
    const hasExpenseId = expenseId != null && expenseId !== '';
    const todayExpense = isToday(dateVal);
    const isDeleting = deletingId != null && String(deletingId) === String(expenseId);
    const canDelete = hasExpenseId && todayExpense;

    return (
      <View style={styles.expenseCard}>
        {/* Left: Title + Status badge */}
        <View style={styles.expenseLeft}>
          <Text style={styles.expenseTitle} numberOfLines={1}>{item.title ?? '—'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Right: Date + Amount */}
        <View style={styles.expenseRight}>
          <Text style={styles.dateText}>{formatDisplayDate(dateVal)}</Text>
          <Text style={styles.amountText}>{formatCurrency(amountVal)}</Text>
        </View>

        {/* Trash icon — vertically centred on the far right */}
        <TouchableOpacity
          style={[styles.deleteIconButton, !canDelete && styles.deleteIconButtonDisabled]}
          onPress={canDelete ? () => handleDeleteExpense(item) : undefined}
          disabled={!canDelete || isDeleting}
          accessibilityRole="button"
          accessibilityLabel={canDelete ? 'Delete expense' : 'Cannot delete past expense'}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={COLORS.text.secondary} />
          ) : (
            <Ionicons
              name="trash-outline"
              size={16}
              color={canDelete ? COLORS.error : COLORS.border}
            />
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.padding * 0.75,
    marginBottom: SIZES.base * 0.75,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  expenseLeft: {
    flex: 1,
    marginRight: SIZES.base,
  },
  expenseRight: {
    alignItems: 'flex-end',
    marginRight: SIZES.base * 0.75,
  },
  deleteIconButton: {
    padding: SIZES.base * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconButtonDisabled: {
    opacity: 0.35,
  },
  expenseTitle: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: SIZES.base * 0.4,
  },
  dateText: {
    fontSize: SIZES.body4,
    color: COLORS.text.tertiary,
    marginBottom: SIZES.base * 0.4,
  },
  amountText: {
    fontSize: SIZES.body3,
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
    paddingVertical: 2,
    paddingHorizontal: SIZES.base * 0.75,
    borderRadius: SIZES.radius * 0.75,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: SIZES.body4,
    fontWeight: '600',
  },
});

export default ExpensesScreen;

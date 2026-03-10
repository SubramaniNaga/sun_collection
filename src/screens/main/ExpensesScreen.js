import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';

const ExpensesScreen = ({ navigation }) => {
  // State for expenses list
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Filter options
  const filterOptions = ['All', 'Pending', 'Process', 'Approved'];

  // Mock expenses data
  const mockExpenses = [
    {
      id: '1',
      title: 'Fuel Expense',
      category: 'Fuel',
      date: '2024-03-15',
      amount: 1500.00,
      status: 'Approved',
    },
    {
      id: '2',
      title: 'Vehicle Maintenance',
      category: 'Vehicle Maintenance',
      date: '2024-03-14',
      amount: 3500.00,
      status: 'Process',
    },
    {
      id: '3',
      title: 'Office Supplies',
      category: 'Office Expense',
      date: '2024-03-13',
      amount: 800.00,
      status: 'Pending',
    },
    {
      id: '4',
      title: 'Staff Lunch',
      category: 'Food / Travel',
      date: '2024-03-12',
      amount: 450.00,
      status: 'Approved',
    },
    {
      id: '5',
      title: 'Collection Travel',
      category: 'Collection Expense',
      date: '2024-03-11',
      amount: 1200.00,
      status: 'Pending',
    },
    {
      id: '6',
      title: 'Office Rent',
      category: 'Office Expense',
      date: '2024-03-10',
      amount: 10000.00,
      status: 'Approved',
    },
    {
      id: '7',
      title: 'Vehicle Insurance',
      category: 'Vehicle Maintenance',
      date: '2024-03-09',
      amount: 2500.00,
      status: 'Process',
    },
    {
      id: '8',
      title: 'Miscellaneous',
      category: 'Miscellaneous',
      date: '2024-03-08',
      amount: 300.00,
      status: 'Pending',
    },
    {
      id: '9',
      title: 'Miscellaneous',
      category: 'Miscellaneous',
      date: '2024-03-08',
      amount: 300.00,
      status: 'Pending',
    },
    {
      id: '10',
      title: 'Miscellaneous',
      category: 'Miscellaneous',
      date: '2024-03-08',
      amount: 300.00,
      status: 'Pending',
    },
  ];

  // Initialize data
  useEffect(() => {
    setExpenses(mockExpenses);
    setFilteredExpenses(mockExpenses);
  }, []);

  // Apply filter
  useEffect(() => {
    if (selectedFilter === 'All') {
      setFilteredExpenses(expenses);
    } else {
      setFilteredExpenses(expenses.filter(expense => expense.status === selectedFilter));
    }
  }, [selectedFilter, expenses]);

  // Handle filter selection
  const handleFilterSelect = (filter) => {
    setSelectedFilter(filter);
    setShowFilterModal(false);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return COLORS.success || '#28a745';
      case 'Process':
        return COLORS.warning || '#ffc107';
      case 'Pending':
        return COLORS.info || '#17a2b8';
      default:
        return COLORS.text.secondary;
    }
  };

  // Render expense item
  const renderExpenseItem = ({ item }) => (
    <View style={styles.expenseCard}>
      {/* Main content row */}
      <View style={styles.expenseMainRow}>
        {/* Left section: Title and meta */}
        <View style={styles.expenseLeftSection}>
          <Text style={styles.expenseTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.expenseMeta}>
            <Text style={styles.categoryText}>{item.category}</Text>
            <Text style={styles.dateText}>• {item.date}</Text>
          </View>
        </View>

        {/* Right section: Status and Amount */}
        <View style={styles.expenseRightSection}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
          <Text style={styles.amountText}>₹{item.amount.toFixed(0)}</Text>
        </View>
      </View>
    </View>
  );

  // Render filter option
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" backgroundColor={COLORS.primary} />

      <Header
        title="Expenses"
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
        {filteredExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={COLORS.text.tertiary} />
            <Text style={styles.emptyStateText}>No expenses found</Text>
            <Text style={styles.emptyStateSubtext}>
              {selectedFilter === 'All'
                ? 'Add your first expense to get started'
                : `No ${selectedFilter.toLowerCase()} expenses found`
              }
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredExpenses}
            renderItem={renderExpenseItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ExpenseAdd')}
      >
        <Ionicons name="add" size={24} color={COLORS.white} />
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
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
              <Text style={styles.filterModalTitle}>Filter Expenses</Text>
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
  // List styles
  listContainer: {
    padding: SIZES.padding,
    paddingTop: SIZES.padding * 0.75,
  },
  // Compact card styles
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
  expenseMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseLeftSection: {
    flex: 1,
    marginRight: SIZES.padding,
  },
  expenseRightSection: {
    alignItems: 'flex-end',
  },
  expenseTitle: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.base * 0.25,
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
  statusBadge: {
    paddingHorizontal: SIZES.base * 0.5,
    paddingVertical: SIZES.base * 0.25,
    borderRadius: SIZES.radius / 2,
    marginBottom: SIZES.base * 0.25,
  },
  statusText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.white,
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
});

export default ExpensesScreen;
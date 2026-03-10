import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import SelectionModal from '../../components/common/SelectionModal';
import { COLORS, SIZES } from '../../constants/theme';

const LoanCustomerListScreen = ({ navigation }) => {
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [showSelectionModal, setShowSelectionModal] = useState(false);

  // Dummy customer data
  const dummyCustomers = [
    { id: '1', name: 'Rahul Kumar', phone: '9876543210', loanId: 'LN001234', initialAmount: '50000', status: 'Active' },
    { id: '2', name: 'Priya Sharma', phone: '9876543211', loanId: 'LN001235', initialAmount: '75000', status: 'Active' },
    { id: '3', name: 'Amit Patel', phone: '9876543212', loanId: 'LN001236', initialAmount: '30000', status: 'Active' },
    { id: '4', name: 'Sneha Reddy', phone: '9876543213', loanId: 'LN001237', initialAmount: '100000', status: 'Active' },
    { id: '5', name: 'Vikram Singh', phone: '9876543214', loanId: 'LN001238', initialAmount: '60000', status: 'Active' },
    { id: '6', name: 'Anjali Gupta', phone: '9876543215', loanId: 'LN001239', initialAmount: '45000', status: 'Closed' },
    { id: '7', name: 'Rajesh Kumar', phone: '9876543216', loanId: 'LN001240', initialAmount: '80000', status: 'Overdue' },
    { id: '8', name: 'Meera Patel', phone: '9876543217', loanId: 'LN001241', initialAmount: '55000', status: 'Active' },
  ];

  // Initialize data
  useEffect(() => {
    // Start with empty list - only show when user searches
    setFilteredCustomers([]);
  }, []);

  // Real-time search filtering
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Clear list when search is empty
      setFilteredCustomers([]);
      return;
    }

    const filtered = dummyCustomers.filter(customer => 
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.loanId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery)
    );
    
    setFilteredCustomers(filtered);
  }, [searchQuery]);

  // Handle customer selection
  const handleCustomerSelect = (customer) => {
    navigation.navigate('LoanScreen', { customerData: customer });
  };

  // Handle add button press
  const handleAddPress = () => {
    setShowSelectionModal(true);
  };

  // Selection options
  const selectionOptions = [
    {
      title: 'Create Customer',
      description: 'Create a new customer',
      icon: 'person-add-outline',
      iconColor: COLORS.primary,
      onPress: () => navigation.navigate('AddCustomer'),
    },
    {
      title: 'Create Customer with Loan',
      description: 'Create a new customer with loan',
      icon: 'cash-outline',
      iconColor: COLORS.success,
      onPress: () => navigation.navigate('CustomerWithLoan'),
    },
  ];

  // Get status color
  const getStatusColor = (status) => {
    if (status === 'Active') {
      return COLORS.success || '#28a745';
    } else if (status === 'Closed') {
      return COLORS.text.secondary || '#6c757d';
    } else if (status === 'Overdue') {
      return COLORS.warning || '#ffc107';
    } else {
      return COLORS.text.secondary;
    }
  };

  // Render customer item
  const renderCustomerItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.customerCard}
      onPress={() => handleCustomerSelect(item)}
    >
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{item.name}</Text>
        <View style={styles.customerMeta}>
          <Text style={styles.customerDetail}>ID: {item.loanId}</Text>
          <Text style={styles.customerDetail}>{item.phone}</Text>
        </View>
        <View style={[styles.statusBadge, { 
          backgroundColor: getStatusColor(item.status)
        }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" backgroundColor={COLORS.primary} />
      
      <Header 
        title="Loan Renewal" 
        showBackButton={true}
        onBackPress={() => navigation.goBack()} 
      />

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={COLORS.primary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
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

      {/* Customer List */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        renderItem={renderCustomerItem}
        contentContainerStyle={styles.customerListContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={COLORS.text.tertiary} />
            <Text style={styles.emptyStateText}>Search for customers</Text>
            <Text style={styles.emptyStateSubText}>Type in the search bar to find customers</Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={handleAddPress}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color={COLORS.white} />
      </TouchableOpacity>

      {/* Selection Modal */}
      <SelectionModal
        visible={showSelectionModal}
        onClose={() => setShowSelectionModal(false)}
        options={selectionOptions}
        title="Select Action"
      />
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
  customerListContainer: {
    padding: SIZES.padding,
  },
  customerCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin * 0.5,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  customerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
  },
  customerMeta: {
    alignItems: 'flex-start',
    flex: 1,
  },
  customerDetail: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 4,
  },
  statusBadge: {
    paddingHorizontal: SIZES.base * 0.75,
    paddingVertical: SIZES.base * 0.25,
    borderRadius: SIZES.radius / 2,
  },
  statusText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.white,
  },
  // Floating Action Button Styles
  fab: {
    position: 'absolute',
    bottom: SIZES.padding * 5,
    right: SIZES.padding * 2,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default LoanCustomerListScreen;

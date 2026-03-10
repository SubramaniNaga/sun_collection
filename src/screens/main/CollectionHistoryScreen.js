import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from '../../components/common/DatePicker';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';

const CollectionHistoryScreen = ({ navigation }) => {
  // State for date filters
  const [startDate, setStartDate] = useState(new Date().toISOString());
  const [endDate, setEndDate] = useState(new Date().toISOString());
  const [errors, setErrors] = useState({});

  // State for collection data
  const [collectionHistory, setCollectionHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);

  // Summary calculations
  const totalReceipts = filteredHistory.length;
  const totalAmount = filteredHistory.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Mock data for demonstration
  const mockCollectionData = [
    { id: 1, receiptNumber: 'R001', customerName: 'John Doe', date: '2024-03-15', amount: 1500 },
    { id: 2, receiptNumber: 'R002', customerName: 'Jane Smith', date: '2024-03-14', amount: 2300 },
    { id: 3, receiptNumber: 'R003', customerName: 'Bob Johnson', date: '2024-03-13', amount: 800 },
    { id: 4, receiptNumber: 'R004', customerName: 'Alice Brown', date: '2024-03-12', amount: 3200 },
    { id: 5, receiptNumber: 'R005', customerName: 'Charlie Wilson', date: '2024-03-11', amount: 1900 },
  ];

  // Initialize with mock data
  useEffect(() => {
    setCollectionHistory(mockCollectionData);
    setFilteredHistory(mockCollectionData);
  }, []);

  // Validation function
  const validateDates = () => {
    const newErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Clear time part for accurate date comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Check if start date is greater than end date
    if (start > end) {
      newErrors.dateRange = 'Start date cannot be greater than end date';
    }
    
    // Check if end date is beyond current date
    if (end > today) {
      newErrors.dateRange = 'End date cannot be beyond current date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler for start date change
  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);
    // Clear errors when start date changes
    setErrors({});
  };

  // Handler for end date change
  const handleEndDateChange = (newEndDate) => {
    setEndDate(newEndDate);
    // Clear any existing errors when a valid date is selected
    setErrors({});
  };
  useEffect(() => {
    if (startDate && endDate) {
      if (validateDates()) {
        const filtered = collectionHistory.filter(item => {
          const itemDate = new Date(item.date);
          const start = new Date(startDate);
          const end = new Date(endDate);

          return itemDate >= start && itemDate <= end;
        });

        setFilteredHistory(filtered);
      }
    }
  }, [startDate, endDate]); // Trigger when dates change

  // Format currency
  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" backgroundColor={COLORS.primary} />

      <Header
        title="Collection History"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date Filter Section */}
        <View style={styles.filterSection}>
          <View style={styles.dateRow}>
            <View style={styles.datePickerContainer}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onValueChange={handleStartDateChange}
                error={errors.startDate}
              />
            </View>

            <View style={styles.datePickerContainer}>
              <DatePicker
                label="End Date"
                value={endDate}
                onValueChange={handleEndDateChange}
                error={errors.endDate}
                minimumDate={startDate ? new Date(startDate) : undefined}
                maximumDate={new Date()}
              />
            </View>
          </View>

          {errors.dateRange && (
            <Text style={styles.errorText}>{errors.dateRange}</Text>
          )}
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Receipts</Text>
              <Text style={styles.summaryValue}>{totalReceipts}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Collection History List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Collection History</Text>

          {filteredHistory.length > 0 ? (
            filteredHistory.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.itemHeader}>
                  <Text style={styles.receiptNumber}>{item.receiptNumber}</Text>
                  <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                </View>

                <View style={styles.itemDetailsRow}>
                  <Text style={styles.customerName}>{item.customerName}</Text>
                  <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No collections found in selected date range</Text>
            </View>
          )}
        </View>
      </ScrollView>
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
    padding: SIZES.padding * 0.5,
  },
  filterSection: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding * 0.3,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin / 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.margin / 3,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.margin / 3,
  },
  datePickerContainer: {
    flex: 1,
    marginHorizontal: SIZES.base / 2,
  },
  errorText: {
    color: 'red',
    fontSize: SIZES.body3,
    marginBottom: SIZES.base / 2,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin / 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 4,
  },
  summaryValue: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  listSection: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyItem: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 0,
    paddingVertical: SIZES.padding / 1.5,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base / 4,
  },
  itemDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptNumber: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  itemAmount: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.primary,
  },
  customerName: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 8,
  },
  itemDate: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
  },
  noDataContainer: {
    padding: SIZES.padding * 1.5,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});

export default CollectionHistoryScreen;

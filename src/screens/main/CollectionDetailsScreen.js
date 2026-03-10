 import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';

const CollectionDetailsScreen = ({ route, navigation }) => {
  const { item } = route.params;
  const [amountToPay, setAmountToPay] = useState('');

  // Mock data for due information
  const dueData = {
    paymentFrequency: item.paymentFrequency || 'monthly', // 'monthly' or 'weekly'
    dueDate: item.dueDate || '20', // day of month or day of week
    currentDue: item.currentDue || 11, // current due amount
  };

  // Get appropriate date display based on payment frequency
  const getDueDateDisplay = () => {
    if (dueData.paymentFrequency === 'monthly') {
      return `${dueData.dueDate}/20`; // showing as "day/month" format
    } else if (dueData.paymentFrequency === 'weekly') {
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return weekdays[dueData.dueDate % 7] || 'Mon'; // showing weekday
    }
    return dueData.dueDate;
  };

  // Mock data for appropriation
  const appropriationData = {
    dueAmount: { display: '₹5,000', value: 5000 },
    arrearAmount: { display: '₹1,200', value: 1200 },
    expensesAmount: { display: '₹200', value: 200 },
    penalCharge: { display: '₹100', value: 100 },
    cashCollectionCharge: { display: '₹50', value: 50 },
    handlingCharges: { display: '₹30', value: 30 },
  };

  // State for appropriation input fields
  const [appropriationInputs, setAppropriationInputs] = useState({
    dueAmount: '',
    arrearAmount: '',
    expensesAmount: '',
    penalCharge: '',
    cashCollectionCharge: '',
    handlingCharges: '',
  });

  // Handle input change with validation
  const handleAppropriationChange = (field, value) => {
    const maxValue = appropriationData[field].value;
    // Remove ₹ symbol and any non-numeric characters except decimal point
    const cleanValue = value.replace(/[₹,]/g, '');
    const numValue = parseFloat(cleanValue) || 0;

    // Validate: don't allow negative values or values greater than max
    if (numValue < 0 || numValue > maxValue) {
      return; // Don't update if invalid
    }

    setAppropriationInputs(prev => ({
      ...prev,
      [field]: cleanValue
    }));
  };

  // Format input value with ₹ symbol for display
  const formatInputValue = (value) => {
    return value ? `₹${value}` : '';
  };

  const calculateTotal = () => {
    // Only include amountToPay, all appropriation functionality is commented out
    return parseFloat(amountToPay) || 0;
  };

  const handleAddPayment = () => {
    // Only send amountToPay, appropriation functionality is commented out
    const paymentData = {
      item: item,
      amountToPay: parseFloat(amountToPay) || 0,
      total: calculateTotal()
    };
    
    console.log('Payment added:', paymentData);
    // Here you would typically send this data to your API
    Alert.alert('Success', `Payment of ₹${paymentData.total.toFixed(2)} added successfully!`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" backgroundColor={COLORS.primary} />

      <Header
        title="Collection Details"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Basic Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Basic Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{item.name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account No</Text>
              <Text style={styles.detailValue}>{item.accountNo}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{item.phone}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due</Text>
              <Text style={styles.detailValue}>{getDueDateDisplay()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Current Due</Text>
              <Text style={styles.detailValue}>{dueData.currentDue}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vehicle No</Text>
              <Text style={styles.detailValue}>{item.vehicleNo}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Assets</Text>
              <Text style={styles.detailValue}>{item.assets}</Text>
            </View>
          </View>

          {/* Amount to Pay Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Amount to Pay</Text>
            <View style={styles.amountInput}>
              <Text>₹</Text>
              <TextInput
                placeholder="Enter amount"
                placeholderTextColor={COLORS.text.tertiary}
                value={amountToPay}
                onChangeText={setAmountToPay}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Appropriation Card - PERMANENTLY COMMENTED OUT */}
          {/* Entire Appropriation Card functionality has been removed */}

          {/* Add padding for bottom fixed section */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed Bottom Section */}
      <SafeAreaView style={styles.bottomSection} edges={['bottom']}>
        <View style={styles.bottomContent}>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{calculateTotal().toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPayment}>
            <Text style={styles.addButtonText}>Add Payment</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: SIZES.base / 2,
  },
  headerTitle: {
    fontSize: SIZES.h2,
    fontWeight: '700',
    color: COLORS.white,
  },
  placeholder: {
    width: 40,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  cardTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.margin,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  detailLabel: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    flex: 1,
  },
  detailValue: {
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
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
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.3,
    fontSize: SIZES.body1,
    color: COLORS.text.primary,
    backgroundColor: COLORS.white,
  },
  appropriationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base,
    gap: SIZES.base,
  },
  appropriationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.margin,
    paddingBottom: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SIZES.base,
  },
  appropriationHeaderLabel: {
    flex: 1.2,
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  appropriationHeaderDue: {
    flex: 0.8,
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textAlign: 'right',
  },
  appropriationHeaderToBePaid: {
    flex: 1,
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  appropriationLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    flex: 1.2,
  },
  appropriationDueAmount: {
    fontSize: SIZES.body3,
    color: COLORS.text.primary,
    fontWeight: '500',
    flex: 0.8,
    textAlign: 'right',
  },
  appropriationToBePaidInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.padding * 0.5,
    fontSize: SIZES.body3,
    color: COLORS.text.primary,
    backgroundColor: COLORS.white,
    flex: 1,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 120,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bottomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    gap: SIZES.margin,
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 2,
  },
  totalValue: {
    fontSize: SIZES.h2,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: SIZES.body2,
  },
});

export default CollectionDetailsScreen;

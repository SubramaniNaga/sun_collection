import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError, showSuccess, showWarning } from '../../utils/alertService';
import { formatCurrency } from '../../utils/amountFormatters';
import { guardAttendanceGatedEntry } from '../../utils/attendanceEntryGate';
import { formatDateTimeDisplay } from '../../utils/dateFormatter';
import { safeGoBack } from '../../utils/navigationHelpers';


const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={2}>{value ?? '—'}</Text>
  </View>
);

const CollectionDetailsScreen = ({ route, navigation }) => {
  const { t } = useLanguage();
  const item = route.params?.item ?? {};
  const [amountToPay, setAmountToPay] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePhonePress = () => {
    if (!item.customer_phone) return;
    Linking.openURL(`tel:${item.customer_phone}`).catch(() =>
      showError('Error', 'Could not open phone dialer')
    );
  };

  const calculateTotal = () => parseFloat(amountToPay) || 0;

  const handleAddPayment = async () => {
    if (!guardAttendanceGatedEntry(t)) return;
    const total = calculateTotal();
    if (total <= 0) {
      showWarning('Invalid', 'Please enter an amount greater than 0.');
      return;
    }
    const collectionId = item.id;
    if (collectionId == null) {
      showError('Error', 'Collection ID not found.');
      return;
    }
    try {
      setSubmitting(true);
      const response = await apiServices.collection.updateAmount(collectionId, {
        amount_paid: total,
      });
      const success = response?.success !== false && (response?.status === 200 || response?.status === undefined);
      const data = response?.data ?? response;
      if (success && data) {
        const amountPaid = data.amount_paid ?? total;
        const balanceAmount = data.balance_amount;
        const collectionWeek = data.collection_week;
        const paidStr = (amountPaid != null && amountPaid !== '') ? formatCurrency(amountPaid) : '—';
        const balanceStr = (balanceAmount != null && balanceAmount !== '') ? formatCurrency(balanceAmount) : '—';
        const weekStr = collectionWeek != null ? String(collectionWeek) : '—';
        showSuccess(
          'Collection amount updated successfully',
          `Amount Paid: ${paidStr}\nBalance Amount: ${balanceStr}\nCollection Week: ${weekStr}`,
          [
            {
              text: 'OK',
              onPress: async () => {
                try {
                  await apiServices.collection.getCollectionList();
                } catch (_) {}
                safeGoBack(navigation);
              },
            },
          ]
        );
      } else {
        showError('Error', response?.message || 'Failed to update collection amount.');
      }
    } catch (err) {
      showError('Error', getApiErrorMessage(err, 'Failed to update collection amount.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title="Collection Details"
        showBackButton={true}
        onBackPress={() => safeGoBack(navigation)}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Customer */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer</Text>
            <DetailRow label="Name" value={item.customer_name} />
            <DetailRow label="Customer No" value={item.customer_no} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <TouchableOpacity onPress={handlePhonePress} style={styles.phoneTouchable}>
                <Text style={[styles.detailValue, styles.phoneLink]}>{item.customer_phone ?? '—'}</Text>
                <Ionicons name="call" size={16} color={COLORS.primary} style={styles.phoneIcon} />
              </TouchableOpacity>
            </View>
            <DetailRow label="Address" value={item.customer_address} />
          </View>

          {/* Collection */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Collection</Text>
            {/* <DetailRow label="Collection ID" value={item.id != null ? String(item.id) : null} /> */}
            <DetailRow label="Collection Week" value={item.collection_week != null ? `Week ${item.collection_week}` : null} />
            <DetailRow label="Collection Date" value={item.collection_date ? formatDateTimeDisplay(item.collection_date) : null} />
            <DetailRow label="Amount Paid" value={formatCurrency(item.amount_paid)} />
            <DetailRow label="Balance Amount" value={formatCurrency(item.balance_amount)} />
            {(item.notes != null && item.notes !== '') && <DetailRow label="Notes" value={item.notes} />}
          </View>

          {/* Loan */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Loan</Text>
            <DetailRow label="Loan ID" value={item.loan_id != null ? String(item.loan_id) : null} />
            <DetailRow label="Loan Amount" value={formatCurrency(item.loan_amount)} />
            <DetailRow label="Approved Amount" value={formatCurrency(item.approved_amount)} />
            <DetailRow label="Loan Period" value={item.loan_period != null ? `${item.loan_period} months` : null} />
            <DetailRow label="Approval Status" value={item.approval_status != null ? String(item.approval_status) : null} />
          </View>

          {/* Branch & Line */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Branch & Line</Text>
            <DetailRow label="Branch" value={item.branch_name} />
            {/* <DetailRow label="Branch ID" value={item.branch_id != null ? String(item.branch_id) : null} /> */}
            <DetailRow label="Line" value={item.line_name} />
            {/* <DetailRow label="Line ID" value={item.line_id != null ? String(item.line_id) : null} /> */}
            <DetailRow label="Employee" value={item.employeename} />
            {/* <DetailRow label="Employee ID" value={item.employee_id != null ? String(item.employee_id) : null} /> */}
            {/* <DetailRow label="Customer ID" value={item.customer_id != null ? String(item.customer_id) : null} /> */}
            <DetailRow label="Locality" value={item.locality} />
          </View>

          {/* Timestamps */}
          {/* <View style={styles.card}>
            <Text style={styles.cardTitle}>Reference</Text>
            <DetailRow label="Created At" value={item.created_at ? formatDateTimeDisplay(item.created_at) : null} />
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={styles.detailLabel}>Updated At</Text>
              <Text style={styles.detailValue} numberOfLines={2}>{item.updated_at ? formatDateTimeDisplay(item.updated_at) : '—'}</Text>
            </View>
          </View> */}

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
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
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
            <Text style={styles.totalValue}>{formatCurrency(calculateTotal())}</Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, submitting && styles.addButtonDisabled]}
            onPress={handleAddPayment}
            disabled={submitting}
          >
            <Text style={styles.addButtonText}>{submitting ? 'Adding...' : 'Add Payment'}</Text>
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
  detailRowLast: {
    marginBottom: 0,
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
  phoneTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  phoneLink: {
    color: COLORS.primary,
    marginRight: SIZES.base / 2,
  },
  phoneIcon: {
    marginLeft: 2,
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
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: SIZES.body2,
  },
});

export default CollectionDetailsScreen;

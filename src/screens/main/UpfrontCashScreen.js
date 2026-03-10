import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import FormInput from '../../components/common/FormInput';
import FormPicker from '../../components/common/FormPicker';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';

const UpfrontCashScreen = ({ navigation }) => {
  const { user } = useAuthContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    amountTaken: '',
    purpose: '',
    cashReceivedFrom: '',
    approvedBy: '',
    remarks: '',
    agentSignature: null,
    managerSignature: null,
  });

  // Float summary state
  const [floatSummary, setFloatSummary] = useState({
    previousFloatBalance: 0,
    totalUpfrontCashTaken: 0,
    totalSettled: 0,
    currentOutstandingFloat: 0,
  });

  // Dropdown options
  const purposeOptions = [
    { label: 'Field Collection Float', value: 'field_collection_float' },
    { label: 'Customer Refund Handling', value: 'customer_refund_handling' },
    { label: 'Petty Expenses', value: 'petty_expenses' },
    { label: 'Emergency Requirement', value: 'emergency_requirement' },
    { label: 'Other', value: 'other' },
  ];

  const cashReceivedFromOptions = [
    { label: 'Manager', value: 'manager' },
    { label: 'Accountant', value: 'accountant' },
    { label: 'Branch Head', value: 'branch_head' },
  ];

  const approvedByOptions = [
    { label: 'John Manager', value: 'john_manager' },
    { label: 'Sarah Accountant', value: 'sarah_accountant' },
    { label: 'Mike Branch Head', value: 'mike_branch_head' },
  ];

  // Auto-filled header data
  const headerData = {
    agentName: user?.name || 'Agent Name',
    agentId: user?.id || 'AG001',
    branchName: user?.branch || 'Main Branch',
    currentDate: new Date().toLocaleDateString('en-IN'),
    entryId: '', // Will be generated after submit
  };

  // Fetch float summary on mount
  useEffect(() => {
    fetchFloatSummary();
  }, []);

  const fetchFloatSummary = async () => {
    try {
      // TODO: Uncomment when API endpoint is available
      // const response = await apiClient.get('/wallet/float-summary');
      // setFloatSummary(response.data);
      
      // Set mock data for now
      setFloatSummary({
        previousFloatBalance: 5000,
        totalUpfrontCashTaken: 2000,
        totalSettled: 1500,
        currentOutstandingFloat: 5500,
      });
    } catch (error) {
      console.error('Error fetching float summary:', error);
      // Set mock data for demo
      setFloatSummary({
        previousFloatBalance: 5000,
        totalUpfrontCashTaken: 2000,
        totalSettled: 1500,
        currentOutstandingFloat: 5500,
      });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.amountTaken) {
      newErrors.amountTaken = 'Amount is required';
    } else if (parseFloat(formData.amountTaken) <= 0) {
      newErrors.amountTaken = 'Amount must be greater than 0';
    }

    if (!formData.purpose) {
      newErrors.purpose = 'Purpose is required';
    }

    if (!formData.cashReceivedFrom) {
      newErrors.cashReceivedFrom = 'Cash received from is required';
    }

    if (!formData.approvedBy) {
      newErrors.approvedBy = 'Approved by is required';
    }

    if (!formData.agentSignature) {
      newErrors.agentSignature = 'Agent signature is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const captureLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Location capture error:', error);
      return null;
    }
  };

  const generateEntryId = () => {
    return `UC${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Capture system data
      const locationData = await captureLocation();
      const entryId = generateEntryId();

      const payload = {
        entryId,
        agentId: headerData.agentId,
        agentName: headerData.agentName,
        branchName: headerData.branchName,
        amountTaken: parseFloat(formData.amountTaken),
        purpose: formData.purpose,
        cashReceivedFrom: formData.cashReceivedFrom,
        approvedBy: formData.approvedBy,
        remarks: formData.remarks,
        modeOfTransfer: 'cash',
        agentSignature: formData.agentSignature,
        managerSignature: formData.managerSignature,
        status: 'ACTIVE',
        timestamp: new Date().toISOString(),
        location: locationData,
        createdBy: headerData.agentId,
        deviceId: 'DEVICE_ID', // Add device ID logic if needed
      };

      // Submit to API
      // TODO: Uncomment when API endpoint is available
      // const response = await apiClient.post('/upfront-cash', payload);
      console.log('Upfront Cash Entry Payload:', payload);

      // Update float summary
      await fetchFloatSummary();

      Alert.alert(
        'Success',
        `Upfront Cash Entry created successfully!\nEntry ID: ${entryId}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit upfront cash entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderHeaderSection = () => (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Agent Information</Text>
      <View style={styles.headerGrid}>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>Agent Name</Text>
          <FormInput
            value={headerData.agentName}
            editable={false}
            style={styles.readonlyInput}
          />
        </View>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>Agent ID</Text>
          <FormInput
            value={headerData.agentId}
            editable={false}
            style={styles.readonlyInput}
          />
        </View>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>Branch Name</Text>
          <FormInput
            value={headerData.branchName}
            editable={false}
            style={styles.readonlyInput}
          />
        </View>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>Date</Text>
          <FormInput
            value={headerData.currentDate}
            editable={false}
            style={styles.readonlyInput}
          />
        </View>
      </View>
    </Card>
  );

  const renderUpfrontCashDetails = () => (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Upfront Cash Details</Text>
      
      <FormInput
        label="Amount Taken (₹)"
        value={formData.amountTaken}
        onChangeText={(value) => handleInputChange('amountTaken', value)}
        placeholder="Enter amount"
        keyboardType="numeric"
        error={errors.amountTaken}
      />

      <FormPicker
        label="Purpose"
        value={formData.purpose}
        onValueChange={(value) => handleInputChange('purpose', value)}
        items={purposeOptions}
        placeholder="Select purpose"
        error={errors.purpose}
      />

      <FormPicker
        label="Cash Received From"
        value={formData.cashReceivedFrom}
        onValueChange={(value) => handleInputChange('cashReceivedFrom', value)}
        items={cashReceivedFromOptions}
        placeholder="Select person"
        error={errors.cashReceivedFrom}
      />

      <FormPicker
        label="Approved By"
        value={formData.approvedBy}
        onValueChange={(value) => handleInputChange('approvedBy', value)}
        items={approvedByOptions}
        placeholder="Select approver"
        error={errors.approvedBy}
      />

      <FormInput
        label="Remarks"
        value={formData.remarks}
        onChangeText={(value) => handleInputChange('remarks', value)}
        placeholder="Enter remarks (optional)"
        multiline
        numberOfLines={3}
      />
    </Card>
  );

  const renderAcknowledgement = () => (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Acknowledgement</Text>
      
      <TouchableOpacity
        style={[
          styles.signatureBox,
          errors.agentSignature && styles.signatureBoxError,
        ]}
        onPress={() => {
          // TODO: Implement signature pad
          Alert.alert('Signature', 'Signature pad will be implemented here');
          handleInputChange('agentSignature', 'mock_signature_data');
        }}
      >
        {formData.agentSignature ? (
          <View style={styles.signatureContent}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
            <Text style={styles.signatureText}>Agent Signature Added</Text>
          </View>
        ) : (
          <View style={styles.signaturePlaceholder}>
            <Ionicons name="create-outline" size={24} color={COLORS.text.tertiary} />
            <Text style={styles.signaturePlaceholderText}>Tap to add Agent Signature</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signatureBox}
        onPress={() => {
          // TODO: Implement signature pad
          Alert.alert('Signature', 'Manager signature pad will be implemented here');
          handleInputChange('managerSignature', 'mock_manager_signature');
        }}
      >
        {formData.managerSignature ? (
          <View style={styles.signatureContent}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
            <Text style={styles.signatureText}>Manager Signature Added</Text>
          </View>
        ) : (
          <View style={styles.signaturePlaceholder}>
            <Ionicons name="create-outline" size={24} color={COLORS.text.tertiary} />
            <Text style={styles.signaturePlaceholderText}>Tap to add Manager Signature (Optional)</Text>
          </View>
        )}
      </TouchableOpacity>

      {errors.agentSignature && (
        <Text style={styles.errorText}>Agent signature is required</Text>
      )}
    </Card>
  );

  const renderFloatSummary = () => (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Float Summary</Text>
      
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Previous Float Balance</Text>
          <Text style={styles.summaryValue}>₹{floatSummary.previousFloatBalance.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Upfront Cash Taken</Text>
          <Text style={styles.summaryValue}>₹{floatSummary.totalUpfrontCashTaken.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Settled</Text>
          <Text style={styles.summaryValue}>₹{floatSummary.totalSettled.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Current Outstanding Float</Text>
          <Text style={[styles.summaryValue, styles.outstandingFloat]}>
            ₹{floatSummary.currentOutstandingFloat.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      
      <Header 
        title="Up-front Cash" 
        showBackButton={true}
        onBackPress={() => navigation.goBack()} 
      />

      <View style={styles.mainContent}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {renderHeaderSection()}
            {renderUpfrontCashDetails()}
            {renderAcknowledgement()}
            {renderFloatSummary()}
            
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <View style={styles.bottomSection}>
        <Button
          title="Submit Upfront Cash Entry"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={styles.submitButton}
          size="large"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainContent: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 6, // Extra padding for fixed button
  },
  sectionCard: {
    marginBottom: SIZES.margin,
  },
  sectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.margin,
  },
  headerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  headerItem: {
    width: '48%',
    marginBottom: SIZES.margin,
  },
  headerLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 2,
  },
  readonlyInput: {
    backgroundColor: COLORS.lightGray,
  },
  signatureBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureBoxError: {
    borderColor: 'red',
  },
  signatureContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signatureText: {
    fontSize: SIZES.body2,
    color: COLORS.primary,
    marginLeft: SIZES.base,
  },
  signaturePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signaturePlaceholderText: {
    fontSize: SIZES.body2,
    color: COLORS.text.tertiary,
    marginLeft: SIZES.base,
  },
  errorText: {
    fontSize: SIZES.body3,
    color: 'red',
    marginTop: SIZES.base / 2,
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
  outstandingFloat: {
    color: COLORS.primary,
  },
  bottomPadding: {
    height: 20,
  },
  bottomSection: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  submitButton: {
    // Additional button styling if needed
  },
});

export default UpfrontCashScreen;

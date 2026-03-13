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
import { useLanguage } from '../../store/LanguageContext';

const UpfrontCashAddScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const { user } = useAuthContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    amountTaken: '',
    purpose: '',
    cashReceivedFrom: '',
    approvedBy: '',
    remarks: '',
    agentSignature: null,
    managerSignature: null,
  });

  const [floatSummary, setFloatSummary] = useState({
    previousFloatBalance: 0,
    totalUpfrontCashTaken: 0,
    totalSettled: 0,
    currentOutstandingFloat: 0,
  });

  const purposeOptions = [
    { label: t('upfrontCash.fieldCollectionFloat'), value: 'field_collection_float' },
    { label: t('upfrontCash.customerRefundHandling'), value: 'customer_refund_handling' },
    { label: t('upfrontCash.pettyExpenses'), value: 'petty_expenses' },
    { label: t('upfrontCash.emergencyRequirement'), value: 'emergency_requirement' },
    { label: t('common.other'), value: 'other' },
  ];

  const cashReceivedFromOptions = [
    { label: t('upfrontCash.manager'), value: 'manager' },
    { label: t('upfrontCash.accountant'), value: 'accountant' },
    { label: t('upfrontCash.branchHead'), value: 'branch_head' },
  ];

  const approvedByOptions = [
    { label: t('upfrontCash.johnManager'), value: 'john_manager' },
    { label: t('upfrontCash.sarahAccountant'), value: 'sarah_accountant' },
    { label: t('upfrontCash.mikeBranchHead'), value: 'mike_branch_head' },
  ];

  const headerData = {
    agentName: user?.name || t('upfrontCash.agentName'),
    agentId: user?.id || 'AG001',
    branchName: user?.branch || t('upfrontCash.mainBranch'),
    currentDate: new Date().toLocaleDateString('en-IN'),
  };

  useEffect(() => {
    fetchFloatSummary();
  }, []);

  const fetchFloatSummary = async () => {
    try {
      setFloatSummary({
        previousFloatBalance: 5000,
        totalUpfrontCashTaken: 2000,
        totalSettled: 1500,
        currentOutstandingFloat: 5500,
      });
    } catch (error) {
      console.error('Error fetching float summary:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.amountTaken) newErrors.amountTaken = t('upfrontCash.amountRequired');
    else if (parseFloat(formData.amountTaken) <= 0) newErrors.amountTaken = t('upfrontCash.amountGreaterThanZero');
    if (!formData.purpose) newErrors.purpose = t('upfrontCash.purposeRequired');
    if (!formData.cashReceivedFrom) newErrors.cashReceivedFrom = t('upfrontCash.cashReceivedFromRequired');
    if (!formData.approvedBy) newErrors.approvedBy = t('upfrontCash.approvedByRequired');
    if (!formData.agentSignature) newErrors.agentSignature = t('upfrontCash.agentSignatureRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const captureLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission denied');
      let locationData = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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

  const generateEntryId = () => `UC${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert(t('common.error'), t('upfrontCash.fillAllRequiredFields'));
      return;
    }
    setIsSubmitting(true);
    try {
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
        deviceId: 'DEVICE_ID',
      };
      console.log('Upfront Cash Entry Payload:', payload);
      Alert.alert(
        t('common.success'),
        t('upfrontCash.entryCreatedSuccessfully', { entryId }),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert(t('common.error'), t('upfrontCash.failedToSubmitEntry'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header title={t('upfrontCash.addUpfrontCash')} showBackButton={true} onBackPress={() => navigation.goBack()} />
      <View style={styles.mainContent}>
        <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('upfrontCash.agentInformation')}</Text>
              <View style={styles.headerGrid}>
                <View style={styles.headerItem}>
                  <Text style={styles.headerLabel}>{t('upfrontCash.agentName')}</Text>
                  <FormInput value={headerData.agentName} editable={false} style={styles.readonlyInput} />
                </View>
                <View style={styles.headerItem}>
                  <Text style={styles.headerLabel}>{t('upfrontCash.agentId')}</Text>
                  <FormInput value={headerData.agentId} editable={false} style={styles.readonlyInput} />
                </View>
                <View style={styles.headerItem}>
                  <Text style={styles.headerLabel}>{t('upfrontCash.branchName')}</Text>
                  <FormInput value={headerData.branchName} editable={false} style={styles.readonlyInput} />
                </View>
                <View style={styles.headerItem}>
                  <Text style={styles.headerLabel}>{t('common.date')}</Text>
                  <FormInput value={headerData.currentDate} editable={false} style={styles.readonlyInput} />
                </View>
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('upfrontCash.upfrontCashDetails')}</Text>
              <FormInput label={t('upfrontCash.amountTaken')} value={formData.amountTaken} onChangeText={(v) => handleInputChange('amountTaken', v)} placeholder={t('upfrontCash.enterAmount')} keyboardType="numeric" error={errors.amountTaken} />
              <FormPicker label={t('upfrontCash.purpose')} value={formData.purpose} onValueChange={(v) => handleInputChange('purpose', v)} items={purposeOptions} placeholder={t('upfrontCash.selectPurpose')} error={errors.purpose} />
              <FormPicker label={t('upfrontCash.cashReceivedFrom')} value={formData.cashReceivedFrom} onValueChange={(v) => handleInputChange('cashReceivedFrom', v)} items={cashReceivedFromOptions} placeholder={t('upfrontCash.selectPerson')} error={errors.cashReceivedFrom} />
              <FormPicker label={t('upfrontCash.approvedBy')} value={formData.approvedBy} onValueChange={(v) => handleInputChange('approvedBy', v)} items={approvedByOptions} placeholder={t('upfrontCash.selectApprover')} error={errors.approvedBy} />
              <FormInput label={t('common.remarks')} value={formData.remarks} onChangeText={(v) => handleInputChange('remarks', v)} placeholder={t('upfrontCash.enterRemarksOptional')} multiline numberOfLines={3} />
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('upfrontCash.acknowledgement')}</Text>
              <TouchableOpacity style={[styles.signatureBox, errors.agentSignature && styles.signatureBoxError]} onPress={() => { Alert.alert(t('upfrontCash.signature'), t('upfrontCash.signaturePadImplementation')); handleInputChange('agentSignature', 'mock_signature_data'); }}>
                {formData.agentSignature ? (
                  <View style={styles.signatureContent}>
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                    <Text style={styles.signatureText}>{t('upfrontCash.agentSignatureAdded')}</Text>
                  </View>
                ) : (
                  <View style={styles.signaturePlaceholder}>
                    <Ionicons name="create-outline" size={24} color={COLORS.text.tertiary} />
                    <Text style={styles.signaturePlaceholderText}>{t('upfrontCash.tapToAddAgentSignature')}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.signatureBox} onPress={() => { Alert.alert(t('upfrontCash.signature'), t('upfrontCash.managerSignaturePadImplementation')); handleInputChange('managerSignature', 'mock_manager_signature'); }}>
                {formData.managerSignature ? (
                  <View style={styles.signatureContent}>
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                    <Text style={styles.signatureText}>{t('upfrontCash.managerSignatureAdded')}</Text>
                  </View>
                ) : (
                  <View style={styles.signaturePlaceholder}>
                    <Ionicons name="create-outline" size={24} color={COLORS.text.tertiary} />
                    <Text style={styles.signaturePlaceholderText}>{t('upfrontCash.tapToAddManagerSignatureOptional')}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {errors.agentSignature && <Text style={styles.errorText}>{t('upfrontCash.agentSignatureRequired')}</Text>}
            </Card>

            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      <View style={styles.bottomSection}>
        <Button title={t('upfrontCash.submitUpfrontCashEntry')} onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting} style={styles.submitButton} size="large" />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mainContent: { flex: 1 },
  keyboardContainer: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { padding: SIZES.padding, paddingBottom: SIZES.padding * 6 },
  sectionCard: { marginBottom: SIZES.margin },
  sectionTitle: { fontSize: SIZES.h3, fontWeight: '600', color: COLORS.text.primary, marginBottom: SIZES.margin },
  headerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  headerItem: { width: '48%', marginBottom: SIZES.margin },
  headerLabel: { fontSize: SIZES.body3, color: COLORS.text.secondary, marginBottom: SIZES.base / 2 },
  readonlyInput: { backgroundColor: COLORS.lightGray },
  signatureBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radius, padding: SIZES.padding, marginBottom: SIZES.margin, minHeight: 80, justifyContent: 'center', alignItems: 'center' },
  signatureBoxError: { borderColor: 'red' },
  signatureContent: { flexDirection: 'row', alignItems: 'center' },
  signatureText: { fontSize: SIZES.body2, color: COLORS.primary, marginLeft: SIZES.base },
  signaturePlaceholder: { flexDirection: 'row', alignItems: 'center' },
  signaturePlaceholderText: { fontSize: SIZES.body2, color: COLORS.text.tertiary, marginLeft: SIZES.base },
  errorText: { fontSize: SIZES.body3, color: 'red', marginTop: SIZES.base / 2 },
  bottomPadding: { height: 20 },
  bottomSection: { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: SIZES.padding, paddingVertical: SIZES.padding },
  submitButton: {},
});

export default UpfrontCashAddScreen;

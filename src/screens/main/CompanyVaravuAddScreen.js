import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import DatePicker from '../../components/common/DatePicker';
import FormInput from '../../components/common/FormInput';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError, showSuccess } from '../../utils/alertService';
import { formatDateForAPI, getCalendarDate, getCalendarDateISO } from '../../utils/dateFormatter';
import { safeGoBack } from '../../utils/navigationHelpers';

const REMARKS_MAX_LENGTH = 500;

const CompanyVaravuAddScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [branchId, setBranchId] = useState('');

  const [formData, setFormData] = useState({
    lineId: '',
    createDate: getCalendarDateISO(),
    amount: '',
    remarks: '',
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const storedBranchId =
          (await AsyncStorage.getItem('user_branch_id')) ||
          (await AsyncStorage.getItem('branchId')) ||
          '';
        const lineIdsJson = await AsyncStorage.getItem('user_line_ids');
        let lineIds = [];

        if (lineIdsJson) {
          try {
            const parsed = JSON.parse(lineIdsJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              lineIds = parsed.map(String);
            }
          } catch {
            lineIds = [];
          }
        }

        if (lineIds.length === 0) {
          const fallbackLineId = await AsyncStorage.getItem('lineId');
          if (fallbackLineId) {
            lineIds = [String(fallbackLineId)];
          }
        }

        if (cancelled) return;

        setBranchId(storedBranchId);
        setFormData((prev) => ({
          ...prev,
          lineId: lineIds.length > 0 ? lineIds[0] : prev.lineId,
        }));
      } catch (error) {
        if (!cancelled) {
          showError(t('common.error'), getApiErrorMessage(error, t('companyVaravu.failedToLoadContext')));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const branchNum = parseInt(branchId, 10);
    const lineNum = parseInt(formData.lineId, 10);
    const amountNum = parseFloat(formData.amount);

    const missingBranchOrLine =
      !branchId?.trim() ||
      Number.isNaN(branchNum) ||
      branchNum <= 0 ||
      !formData.lineId?.trim() ||
      Number.isNaN(lineNum) ||
      lineNum <= 0;

    if (missingBranchOrLine) {
      return false;
    }

    if (!formData.createDate) {
      newErrors.createDate = t('companyVaravu.dateRequired');
    } else {
      const selectedDate = new Date(formData.createDate);
      const today = getCalendarDate();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        newErrors.createDate = t('companyVaravu.futureDateError');
      }
    }

    if (!formData.amount?.trim()) {
      newErrors.amount = t('companyVaravu.amountRequired');
    } else if (Number.isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = t('companyVaravu.amountGreaterThanZero');
    }

    if (formData.remarks?.trim().length > REMARKS_MAX_LENGTH) {
      newErrors.remarks = t('companyVaravu.remarksTooLong', { max: REMARKS_MAX_LENGTH });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    const branchNum = parseInt(branchId, 10);
    const lineNum = parseInt(formData.lineId, 10);
    const missingBranchOrLine =
      !branchId?.trim() ||
      Number.isNaN(branchNum) ||
      branchNum <= 0 ||
      !formData.lineId?.trim() ||
      Number.isNaN(lineNum) ||
      lineNum <= 0;

    if (missingBranchOrLine) {
      showError(t('common.error'), t('companyVaravu.failedToLoadContext'));
      return;
    }

    if (!validateForm()) {
      showError(t('common.error'), t('companyVaravu.fillAllRequiredFields'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        branch_id: parseInt(branchId, 10),
        line_id: parseInt(formData.lineId, 10),
        create_date: formatDateForAPI(formData.createDate),
        amount: parseFloat(formData.amount),
        remarks: formData.remarks.trim(),
      };

      await apiServices.companyVaravu.create(payload);
      showSuccess(t('common.success'), t('companyVaravu.createSuccess'), [
        { text: t('common.ok'), onPress: () => safeGoBack(navigation) },
      ]);
    } catch (error) {
      showError(t('common.error'), getApiErrorMessage(error, t('companyVaravu.failedToSubmit')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header
        title={t('companyVaravu.title')}
        showBackButton
        onBackPress={() => safeGoBack(navigation)}
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
            <Card style={styles.sectionCard}>
              <DatePicker
                label={t('companyVaravu.createDate')}
                value={formData.createDate}
                onValueChange={(value) => handleInputChange('createDate', value)}
                error={errors.createDate}
                required
              />

              <FormInput
                label={t('companyVaravu.amount')}
                value={formData.amount}
                onChangeText={(value) => handleInputChange('amount', value)}
                placeholder={t('companyVaravu.enterAmount')}
                keyboardType="decimal-pad"
                error={errors.amount}
                required
              />

              <FormInput
                label={t('companyVaravu.remarks')}
                value={formData.remarks}
                onChangeText={(value) => handleInputChange('remarks', value)}
                placeholder={t('companyVaravu.enterRemarks')}
                multiline
                numberOfLines={4}
                error={errors.remarks}
              />
              <Text style={styles.helperText}>
                {t('companyVaravu.remarksOptional')}
              </Text>
            </Card>
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      <View style={styles.bottomSection}>
        <Button
          title={t('companyVaravu.submit')}
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
    paddingBottom: SIZES.padding * 6,
  },
  sectionCard: {
    marginBottom: SIZES.margin,
  },
  helperText: {
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
    marginTop: -SIZES.base,
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
  },
  submitButton: {},
});

export default CompanyVaravuAddScreen;

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import FormInput from '../../components/common/FormInput';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError, showSuccess } from '../../utils/alertService';
import { safeGoBack } from '../../utils/navigationHelpers';

const UpfrontCashAddScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const { user } = useAuthContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    amount: '',
    type: 'cash',
    message: '',
  });
  const [userIdDisplay, setUserIdDisplay] = useState('');

  useEffect(() => {
    if (user?.id != null && user.id !== '') {
      setUserIdDisplay(String(user.id));
      return;
    }
    AsyncStorage.getItem('userId').then((id) => setUserIdDisplay(id && id.trim() ? id : '—'));
  }, [user?.id]);

  const typeOptions = [
    { label: t('upfrontCash.typeCash'), value: 'cash' },
    { label: t('upfrontCash.typeOnline'), value: 'online' },
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.amount?.trim()) {
      newErrors.amount = t('upfrontCash.amountRequired');
    } else if (parseFloat(formData.amount) <= 0 || Number.isNaN(parseFloat(formData.amount))) {
      newErrors.amount = t('upfrontCash.amountGreaterThanZero');
    }
    if (!formData.type) {
      newErrors.type = t('upfrontCash.typeRequired');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resolveUserId = async () => {
    if (user?.id != null && user.id !== '') {
      return String(user.id);
    }
    const stored = await AsyncStorage.getItem('userId');
    return stored || '';
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showError(t('common.error'), t('upfrontCash.fillAllRequiredFields'));
      return;
    }
    const userId = await resolveUserId();
    if (!userId) {
      showError(t('common.error'), t('upfrontCash.userIdMissing'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        amount: parseFloat(formData.amount),
        type: formData.type,
        user_id: userId,
        message: formData.message.trim(),
      };
      await apiServices.upfrontCash.createFrontCash(payload);
      showSuccess(t('common.success'), t('upfrontCash.frontCashSuccess'), [
        { text: t('common.ok'), onPress: () => safeGoBack(navigation) },
      ]);
    } catch (error) {
      showError(t('common.error'), getApiErrorMessage(error, t('upfrontCash.failedToSubmitEntry')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header title={t('upfrontCash.addUpfrontCash')} showBackButton={true} onBackPress={() => safeGoBack(navigation)} />
      <View style={styles.mainContent}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Card style={styles.sectionCard}>
              {/* <Text style={styles.sectionTitle}>{t('upfrontCash.upfrontCashDetails')}</Text> */}
              <FormInput
                label={t('upfrontCash.amount')}
                value={formData.amount}
                onChangeText={(v) => handleInputChange('amount', v)}
                placeholder={t('upfrontCash.enterAmount')}
                keyboardType="numeric"
                error={errors.amount}
                required
              />
              <View style={styles.typeField}>
                <Text style={styles.typeLabel}>{t('upfrontCash.transactionType')}</Text>
                <View style={styles.typeRadioList}>
                  {typeOptions.map((opt) => {
                    const selected = formData.type === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        style={({ pressed }) => [
                          styles.typeRadioRow,
                          selected && styles.typeRadioRowSelected,
                          errors.type && styles.typeRadioRowError,
                          pressed && styles.typeRadioRowPressed,
                        ]}
                        onPress={() => handleInputChange('type', opt.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <View
                          style={[
                            styles.radioOuter,
                            selected && styles.radioOuterSelected,
                            errors.type && !selected && styles.radioOuterError,
                          ]}
                        >
                          {selected ? <View style={styles.radioInner} /> : null}
                        </View>
                        <Text style={styles.typeRadioText}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.type ? (
                  <Text style={styles.typeErrorText}>{errors.type}</Text>
                ) : null}
              </View>
              <FormInput
                label={t('upfrontCash.description')}
                value={formData.message}
                onChangeText={(v) => handleInputChange('message', v)}
                placeholder={t('upfrontCash.enterDescription')}
                multiline
                numberOfLines={4}
                error={errors.message}
              />
            </Card>
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      <View style={styles.bottomSection}>
        <Button
          title={t('upfrontCash.submitUpfrontCashEntry')}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  mainContent: { flex: 1 },
  keyboardContainer: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { padding: SIZES.padding, paddingBottom: SIZES.padding * 6 },
  sectionCard: { marginBottom: SIZES.margin },
  sectionTitle: { fontSize: SIZES.h3, fontWeight: '600', color: COLORS.text.primary, marginBottom: SIZES.margin },
  typeField: { marginBottom: SIZES.margin },
  typeLabel: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SIZES.base,
  },
  typeRadioList: {
    flexDirection: 'row',
    width: '100%',
    gap: SIZES.base,
    alignItems: 'stretch',
  },
  typeRadioRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 0.65,
    paddingHorizontal: SIZES.padding * 0.75,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.white,
  },
  typeRadioRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(29, 126, 226, 0.06)',
  },
  typeRadioRowError: {
    borderColor: 'red',
  },
  typeRadioRowPressed: {
    opacity: 0.92,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: COLORS.primary,
  },
  radioOuterError: {
    borderColor: 'red',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  typeRadioText: {
    marginLeft: SIZES.base + 2,
    fontSize: SIZES.body2,
    color: COLORS.black,
    flexShrink: 1,
  },
  typeErrorText: {
    fontSize: SIZES.body3,
    color: 'red',
    marginTop: SIZES.base / 2,
  },
  bottomPadding: { height: 20 },
  bottomSection: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
  },
  submitButton: {},
});

export default UpfrontCashAddScreen;

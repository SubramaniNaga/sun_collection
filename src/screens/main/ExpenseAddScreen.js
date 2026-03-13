import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from '../../components/common/DatePicker';
import FormInput from '../../components/common/FormInput';
import FormPicker from '../../components/common/FormPicker';
import Header from '../../components/common/Header';
import CustomImagePicker from '../../components/common/ImagePicker';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';

const ExpenseAddScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    amount: '',
    date: new Date().toISOString(),
    description: '',
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [errors, setErrors] = useState({});

  const categories = [
    { label: 'Fuel', value: 'fuel' },
    { label: 'Vehicle Maintenance', value: 'vehicle_maintenance' },
    { label: 'Office Expense', value: 'office_expense' },
    { label: 'Staff Expense', value: 'staff_expense' },
    { label: 'Collection Expense', value: 'collection_expense' },
    { label: 'Food / Travel', value: 'food_travel' },
    { label: 'Miscellaneous', value: 'miscellaneous' },
  ];

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = t('expenses.typeRequired');
    if (!formData.category) newErrors.category = t('expenses.typeRequired');
    if (!formData.amount) {
      newErrors.amount = t('expenses.amountRequired');
    } else if (parseFloat(formData.amount) <= 0) {
      newErrors.amount = t('validation.invalidAmount');
    }
    if (!formData.date) newErrors.date = t('expenses.dateRequired');
    if (!selectedImage) newErrors.image = t('customer.imageRequired');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        image: selectedImage,
      };
      console.log('Expense Payload:', payload);

      Alert.alert(t('common.success'), t('success.saved'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() }
      ]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('expenses.addExpense')}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <FormInput
            label={t('expenses.expenseType')}
            value={formData.title}
            onChangeText={(value) => handleInputChange('title', value)}
            placeholder={t('expenses.expenseType')}
            error={errors.title}
          />

          <FormPicker
            label={t('expenses.expenseType')}
            value={formData.category}
            onValueChange={(value) => handleInputChange('category', value)}
            items={categories}
            placeholder={t('expenses.expenseType')}
            error={errors.category}
          />

          <FormInput
            label={t('expenses.expenseAmount')}
            value={formData.amount}
            onChangeText={(value) => handleInputChange('amount', value)}
            placeholder="0.00"
            keyboardType="numeric"
            error={errors.amount}
          />

          <DatePicker
            label={t('expenses.expenseDate')}
            value={formData.date}
            onValueChange={(value) => handleInputChange('date', value)}
            error={errors.date}
          />

          <FormInput
            label={t('expenses.description')}
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            placeholder={t('expenses.description')}
            multiline
            numberOfLines={4}
          />

          <CustomImagePicker
            image={selectedImage}
            onImageChange={setSelectedImage}
            error={errors.image}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Ionicons name="cloud-upload-outline" size={20} color={COLORS.white} style={{ marginRight: SIZES.base }} />
          <Text style={styles.submitButtonText}>{t('common.submit')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 0.5, // Minimal space at bottom
  },
  bottomSection: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 0.5, // Minimal space above button
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.padding, // Reverted to original button size
    borderRadius: SIZES.radius,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ExpenseAddScreen;

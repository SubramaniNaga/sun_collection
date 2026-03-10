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

const ExpenseAddScreen = ({ navigation }) => {
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
    if (!formData.title.trim()) newErrors.title = 'Expense title is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.amount) {
      newErrors.amount = 'Amount is required';
    } else if (parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.date) newErrors.date = 'Date is required';
    if (!selectedImage) newErrors.image = 'Receipt image is required';

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

      Alert.alert('Success', 'Expense uploaded successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <Header
        title="Add Expense"
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
            label="Expense Title"
            value={formData.title}
            onChangeText={(value) => handleInputChange('title', value)}
            placeholder="Enter expense title"
            error={errors.title}
          />

          <FormPicker
            label="Category"
            value={formData.category}
            onValueChange={(value) => handleInputChange('category', value)}
            items={categories}
            placeholder="Select category"
            error={errors.category}
          />

          <FormInput
            label="Amount"
            value={formData.amount}
            onChangeText={(value) => handleInputChange('amount', value)}
            placeholder="0.00"
            keyboardType="numeric"
            error={errors.amount}
          />

          <DatePicker
            label="Date"
            value={formData.date}
            onValueChange={(value) => handleInputChange('date', value)}
            error={errors.date}
          />

          <FormInput
            label="Description / Notes"
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            placeholder="Enter description (optional)"
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
          <Text style={styles.submitButtonText}>Submit</Text>
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

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import ScreenWrapper from '../../components/layout/ScreenWrapper';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';

const RegisterScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  
  const { register, loading } = useAuthContext();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRegister = async () => {
    const newErrors = {};
    
    if (!formData.name) newErrors.name = t('auth.nameRequired');
    if (!formData.email) newErrors.email = t('auth.emailRequired');
    if (!formData.password) newErrors.password = t('auth.passwordRequired');
    if (!formData.confirmPassword) newErrors.confirmPassword = t('auth.confirmPasswordRequired');
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordsDoNotMatch');
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
      // Navigation will be handled automatically by AuthContext state change
    } catch (error) {
      setErrors({ general: error.message });
    }
  };

  return (
    <ScreenWrapper scrollable>
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text style={styles.title}>{t('auth.createAccount')}</Text>
          <Text style={styles.subtitle}>{t('auth.signUpToGetStarted')}</Text>
          
          <Input
            label={t('auth.fullName')}
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
            placeholder={t('auth.enterFullName')}
            error={errors.name}
          />
          
          <Input
            label={t('common.email')}
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            placeholder={t('auth.enterPassword')}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          
          <Input
            label={t('auth.password')}
            value={formData.password}
            onChangeText={(value) => handleInputChange('password', value)}
            placeholder={t('auth.enterPassword')}
            secureTextEntry
            error={errors.password}
          />
          
          <Input
            label={t('auth.confirmPassword')}
            value={formData.confirmPassword}
            onChangeText={(value) => handleInputChange('confirmPassword', value)}
            placeholder={t('auth.enterConfirmPassword')}
            secureTextEntry
            error={errors.confirmPassword}
          />
          
          {errors.general && (
            <Text style={styles.errorText}>{errors.general}</Text>
          )}
          
          <Button
            title={t('auth.signUp')}
            onPress={handleRegister}
            loading={loading}
            style={styles.registerButton}
          />
          
          <Button
            title={t('auth.alreadyHaveAccount')}
            onPress={() => navigation.navigate('Login')}
            variant="ghost"
            style={styles.loginButton}
          />
        </Card>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding,
  },
  card: {
    padding: SIZES.padding * 2,
  },
  title: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SIZES.base,
  },
  subtitle: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SIZES.padding * 2,
  },
  registerButton: {
    marginTop: SIZES.padding,
  },
  loginButton: {
    marginTop: SIZES.padding,
  },
  errorText: {
    color: COLORS.error,
    fontSize: SIZES.body4,
    textAlign: 'center',
    marginTop: SIZES.base,
  },
});

export default RegisterScreen;

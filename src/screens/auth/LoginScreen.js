import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';

const LoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const { login, loading } = useAuthContext();
  const { t } = useLanguage();

  const handlePhoneChange = (text) => {
    // Remove any non-numeric characters
    const numericValue = text.replace(/[^0-9]/g, '');
    
    // Enforce that first digit must be above 5 (6, 7, 8, or 9)
    if (numericValue.length > 0) {
      const firstDigit = parseInt(numericValue[0]);
      if (firstDigit <= 5) {
        return; // Don't allow if first digit is 0-5
      }
    }
    
    // Limit to 10 digits
    if (numericValue.length <= 10) {
      setPhone(numericValue);
      // Clear phone error when user starts typing
      if (errors.phone) {
        setErrors({ ...errors, phone: null });
      }
    }
  };

  const handleLogin = async () => {
    const newErrors = {};

    if (!phone) {
      newErrors.phone = t('auth.phoneRequired');
    } else if (phone.length !== 10) {
      newErrors.phone = t('auth.phoneInvalid');
    } else {
      const firstDigit = parseInt(phone[0]);
      if (firstDigit <= 5) {
        newErrors.phone = t('auth.phoneInvalidStart');
      }
    }
    
    if (!password) {
      newErrors.password = t('auth.passwordRequired');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await login({ phone, password });
      // Navigation will be handled automatically by AuthContext state change
    } catch (error) {
      const message = getLoginErrorMessage(error);
      setErrors({ general: message });
      Alert.alert('Error', message);
    }
  };

  const getLoginErrorMessage = (error) => {
    if (!error) return t('auth.loginError');
    if (typeof error.message === 'string' && error.message && !error.message.startsWith('API Error:')) {
      return error.message;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (typeof error.message === 'string') {
      try {
        const parsed = JSON.parse(error.message.replace(/^API Error:\s*/, ''));
        if (parsed?.message) return parsed.message;
      } catch (_) {}
    }
    return error.message || t('auth.loginError');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" backgroundColor={COLORS.statusBar} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.card}>
        <Text style={styles.title}>{t('auth.welcome')}</Text>
        <Text style={styles.title}>{t('auth.sunMicrofinance')}</Text>
        <Text style={styles.subtitle}>{t('auth.signInToContinue')}</Text>

          <Input
            label={t('auth.phoneNumber')}
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder={t('auth.enterPhone')}
            keyboardType="phone-pad"
            autoCapitalize="none"
            maxLength={10}
            error={errors.phone}
          />

          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.enterPassword')}
            secureTextEntry={!showPassword}
            error={errors.password}
            rightIcon={
              <TouchableOpacity 
                onPress={togglePasswordVisibility}
                style={styles.eyeIconInside}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color={COLORS.primary} 
                />
              </TouchableOpacity>
            }
          />

          {errors.general && (
            <Text style={styles.errorText}>{errors.general}</Text>
          )}

          <Button
            title={t('auth.signIn')}
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          <Button
            // title="Don't have an account? Sign Up"
            onPress={() => navigation.navigate('Register')}
            variant="ghost"
            style={styles.signupButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding,
  },
  card: {
    padding: 2,
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
  loginButton: {
    marginTop: SIZES.padding,
  },
  signupButton: {
    marginTop: SIZES.padding,
  },
  errorText: {
    color: COLORS.error,
    fontSize: SIZES.body4,
    textAlign: 'center',
    marginTop: SIZES.base,
  },
  eyeIconInside: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIconText: {
    fontSize: 16,
    color: COLORS.text.secondary,
  },
});

export default LoginScreen;

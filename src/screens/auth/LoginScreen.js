import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../api/apiClient';
import ENDPOINTS from '../../api/endpoints';
import apiServices from '../../api/services/apiServices';
import AppUpdateBottomSheet from '../../components/common/AppUpdateBottomSheet';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS, SIZES } from '../../constants/theme';
import { useAppVersionCheck } from '../../hooks/useAppVersionCheck';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';
import { showError, showInfo, showWarning } from '../../utils/alertService';
import { getDeviceId } from '../../utils/deviceId';
import { registerForPushNotificationsAsync } from '../../utils/notifications';

const LoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const phoneAutoAdvancedRef = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deviceConflictData, setDeviceConflictData] = useState(null);
  const [fcmToken, setFcmToken] = useState(null);

  const { login, loading } = useAuthContext();
  const { t } = useLanguage();
  const { runCheck, updatePayload, clearUpdate } = useAppVersionCheck();

  useFocusEffect(
    useCallback(() => {
      runCheck();
      const showLogoutReasonIfAny = async () => {
        try {
          const [reason, message] = await AsyncStorage.multiGet(['logoutReason', 'logoutReasonMessage']);
          const logoutReason = reason?.[1];
          const logoutReasonMessage = message?.[1];

          if (!logoutReason) return;

          await AsyncStorage.multiRemove(['logoutReason', 'logoutReasonMessage']);

          if (logoutReason === 'device_mismatch') {
            showWarning(
              t('auth.loggedOutTitle'),
              logoutReasonMessage || t('auth.deviceMismatchLoggedOutMessage')
            );
            return;
          }

          showWarning(
            t('auth.loggedOutTitle'),
            t('auth.sessionExpiredLoggedOutMessage')
          );
        } catch (error) {
          console.warn('LoginScreen logout reason read error:', error);
        }
      };

      showLogoutReasonIfAny();
    }, [runCheck, t])
  );

  // Generate FCM token when screen appears
  useEffect(() => {
    const generateFCMToken = async () => {
      try {
        console.log('🔔 Generating FCM token on LoginScreen mount...');
        const token = await registerForPushNotificationsAsync();
        if (token) {
          console.log('🔔 FCM TOKEN (LoginScreen):', token);
          setFcmToken(token);
          await AsyncStorage.setItem('fcmToken', token);
        } else {
          console.log('🔔 FCM TOKEN (LoginScreen): NOT AVAILABLE');
        }
      } catch (error) {
        console.warn('🔔 Error generating FCM token:', error);
        // Don't show error to user for FCM token failure - it's optional
      }
    };

    generateFCMToken();
  }, []);

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
      if (numericValue.length === 10 && !phoneAutoAdvancedRef.current) {
        phoneAutoAdvancedRef.current = true;
        passwordRef.current?.focus();
      }
      if (numericValue.length < 10) {
        phoneAutoAdvancedRef.current = false;
      }
    }
  };

  /**
   * Handle device change request
   * @param {string} mobileNo - User's mobile number
   * @param {string} deviceId - Current device ID
   * @param {string} token - Token from login response (if available)
   */
  const handleChangeDevice = async (mobileNo, deviceId, token = null) => {
    try {
      console.log('🔄 Initiating device change...', { mobileNo, deviceId, hasToken: !!token });
      
      // Call change-device API with token if available
      const response = await apiServices.auth.changeDevice(mobileNo, deviceId, token);
      
      console.log('🔄 Device change response:', response);
      
      // Check if response indicates admin approval is needed
      if (response?.code === 200 && response?.message?.includes('admin approves')) {
        console.log('🔄 Admin approval required, showing message...');
        
        // Show the admin approval message
        showInfo(
          'Device Update',
          response.message,
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('🔄 User acknowledged admin approval message');
                setIsLoading(false);
                setDeviceConflictData(null);
              }
            }
          ]
        );
        
        // Return here - don't retry login until admin approves
        return;
      }
      
      // If successful device change without admin approval, retry login automatically
      console.log('🔄 Device change successful, retrying login...');
      await performLogin();
      
    } catch (error) {
      
      // Show error and reset loading state
      const errorMessage = error.response?.data?.message || error.message || 'Failed to change device';
      showError('Error', errorMessage);
      setIsLoading(false);
      setDeviceConflictData(null);
    }
  };

  /**
   * Clean reusable function for login API call
   * @param {string} phone - User phone number
   * @param {string} password - User password
   * @param {string} deviceId - Device ID
   * @param {string} firebaseToken - FCM token (optional)
   * @returns {Promise} Login response
   */
  const callLoginAPI = async (phone, password, deviceId, firebaseToken = null) => {
    const requestPayload = {
      phone: phone,
      password: password,
      device_id: deviceId
    };

    if (firebaseToken) {
      requestPayload.firebase_token = firebaseToken;
    }

    console.log('🔔 LOGIN API - Firebase token:', firebaseToken || 'NOT AVAILABLE');
    console.log('🔑 Calling login API with payload:', JSON.stringify(requestPayload, null, 2));
    
    const response = await apiClient.post(ENDPOINTS.AUTH.LOGIN, requestPayload);
    
    console.log('🔑 Login API response:', JSON.stringify(response.data, null, 2));
    
    return response;
  };

  /**
   * Perform actual login with credentials
   */
  const performLogin = async () => {
    try {
      const deviceId = await getDeviceId();

      let firebaseToken = fcmToken || (await AsyncStorage.getItem('fcmToken'));
      if (!firebaseToken) {
        firebaseToken = await registerForPushNotificationsAsync();
        if (firebaseToken) {
          setFcmToken(firebaseToken);
          await AsyncStorage.setItem('fcmToken', firebaseToken);
        }
      }

      console.log('🔔 LOGIN - Firebase token to send:', firebaseToken || 'NOT AVAILABLE');

      const response = await callLoginAPI(phone, password, deviceId, firebaseToken);
      
      // Check for device conflict in response (code 600)
      if (response.data?.code === 600) {
        console.log('🔄 Device conflict detected, showing alert...');
        
        // Extract token from response if available
        const conflictToken = response.data?.token || null;
        const conflictMessage = response.data?.message || 'You are logged in on another device. Do you want to continue on this mobile?';
        
        // Store conflict data for later use
        setDeviceConflictData({
          phone: phone,
          deviceId: deviceId,
          token: conflictToken,
          message: conflictMessage
        });
        
        // Stop loading and show alert
        setIsLoading(false);
        
        // Show device conflict alert
        showWarning(
          'Device Conflict',
          conflictMessage,
          [
            {
              text: 'No',
              style: 'cancel',
              onPress: () => {
                console.log('🔄 User cancelled device change');
                setDeviceConflictData(null);
              }
            },
            {
              text: 'Yes',
              onPress: async () => {
                console.log('🔄 User confirmed device change');
                setIsLoading(true); // Resume loading
                
                // Call change-device API with token if available
                await handleChangeDevice(phone, deviceId, conflictToken);
              }
            }
          ]
        );
        
        // Return here to prevent further processing
        return;
      }
      
      // Successful login - process response
      const { token, data } = response.data;
      
      if (token && data) {
        // Store token and user data
        await AsyncStorage.setItem('authToken', token);
        await AsyncStorage.setItem('userData', JSON.stringify(data));
        
        // Store additional user data
        const languagePreference = data.language || data.lang;
        if (languagePreference) {
          await AsyncStorage.setItem('@app_language', languagePreference);
        }
        
        // Parse and store line_id and branch_id
        let parsedLineIds = ['1'];
        let branchIdToStore = '1';
        
        try {
          if (data.line_id != null && data.line_id !== '') {
            if (typeof data.line_id === 'string') {
              const parsed = JSON.parse(data.line_id);
              parsedLineIds = Array.isArray(parsed) && parsed.length > 0 ? parsed : [data.line_id];
            } else if (Array.isArray(data.line_id)) {
              parsedLineIds = data.line_id;
            } else {
              parsedLineIds = [String(data.line_id)];
            }
          }
          
          if (data.branch_id != null && data.branch_id !== '') {
            branchIdToStore = String(data.branch_id);
          }
        } catch (error) {
          console.warn('🔑 Error parsing line_id/branch_id:', error);
        }
        
        await AsyncStorage.setItem('user_line_ids', JSON.stringify(parsedLineIds));
        await AsyncStorage.setItem('user_branch_id', branchIdToStore);
        await AsyncStorage.setItem('lineId', parsedLineIds[0]);
        await AsyncStorage.setItem('branchId', branchIdToStore);
        
        // Store additional fields
        await AsyncStorage.setItem('userId', data.id?.toString() || '');
        await AsyncStorage.setItem('userName', data.name || '');
        await AsyncStorage.setItem('userPhone', data.phone || '');
        await AsyncStorage.setItem('userRole', data.role || '');
        await AsyncStorage.setItem('userRoleId', data.roleid?.toString() || '');
        await AsyncStorage.setItem('userDevice', data.device || '');
        await AsyncStorage.setItem('loanType', data.loan_type?.toString() || '');
        
        // Store device ID for dashboard API calls
        await AsyncStorage.setItem('deviceId', deviceId);
        
        console.log('� Login successful and data stored');
      }
      
      await login({
        phone,
        password,
        device_id: deviceId,
        firebase_token: firebaseToken,
      });
      
      // Reset states
      setIsLoading(false);
      setDeviceConflictData(null);
      
    } catch (error) {
      
      // Check if it's a device conflict error (code 600)
      if (error.response?.data?.code === 600) {
        console.log('🔄 Device conflict detected from error, showing alert...');
        
        // Extract token from error response if available
        const conflictToken = error.response?.data?.token || null;
        const conflictMessage = error.response?.data?.message || 'You are logged in on another device. Do you want to continue on this mobile?';
        
        // Store conflict data for later use
        setDeviceConflictData({
          phone: phone,
          deviceId: await getDeviceId(),
          token: conflictToken,
          message: conflictMessage
        });
        
        // Stop loading and show alert
        setIsLoading(false);
        
        // Show device conflict alert
        showWarning(
          'Device Conflict',
          conflictMessage,
          [
            {
              text: 'No',
              style: 'cancel',
              onPress: () => {
                console.log('🔄 User cancelled device change');
                setDeviceConflictData(null);
              }
            },
            {
              text: 'Yes',
              onPress: async () => {
                console.log('🔄 User confirmed device change');
                setIsLoading(true); // Resume loading
                
                // Get current device ID
                const currentDeviceId = await getDeviceId();
                
                // Call change-device API with token if available
                await handleChangeDevice(phone, currentDeviceId, conflictToken);
              }
            }
          ]
        );
        
        // Return here to prevent error from being re-thrown
        return;
      } else {
        // Handle other login errors
        const message = getLoginErrorMessage(error);
        setErrors({ general: message });
        showError('Error', message);
        setIsLoading(false);
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

    // Prevent multiple API calls
    if (isLoading) {
      console.log('🔄 Login already in progress, ignoring...');
      return;
    }

    setIsLoading(true);
    setErrors({});
    setDeviceConflictData(null);
    
    try {
      // Perform login
      await performLogin();
    } catch (error) {
      // Error is already handled in performLogin, but we need to ensure loading stops
      // if performLogin doesn't handle it properly
      if (error.response?.data?.code !== 600) {
        setIsLoading(false);
      }
    }
  };

  const getLoginErrorMessage = (error) => {
    if (!error) return t('auth.loginError');
    
    // Check for device ID mismatch error
    if (error.response?.data?.message?.toLowerCase().includes('device id mismatch') ||
        error.response?.data?.message?.toLowerCase().includes('device mismatch') ||
        error.response?.data?.message?.toLowerCase().includes('device id')) {
      const errorMessage = error.response.data.message;
      // Show popup for device mismatch errors
      showError('Device ID Mismatch', errorMessage);
      return errorMessage;
    }
    
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
    <>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="dark" backgroundColor={COLORS.statusBar} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          <View style={styles.card}>
            <Image
              source={require('../../../assets/images/favicon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>{t('auth.welcome')}</Text>
            <Text style={styles.title}>{t('auth.sunMicrofinance')}</Text>
            <Text style={styles.subtitle}>{t('auth.signInToContinue')}</Text>

            <Input
              ref={phoneRef}
              label={t('auth.phoneNumber')}
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder={t('auth.enterPhone')}
              keyboardType="phone-pad"
              autoCapitalize="none"
              maxLength={10}
              error={errors.phone}
              returnKeyType="next"
              blurOnSubmit={false}
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <Input
              ref={passwordRef}
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.enterPassword')}
              secureTextEntry={!showPassword}
              error={errors.password}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
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
              loading={isLoading || loading}
              style={styles.loginButton}
            />

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {updatePayload && (
        <AppUpdateBottomSheet
          visible
          currentVersion={updatePayload.currentVersion}
          latestVersion={updatePayload.latestVersion}
          forceUpdate={updatePayload.forceUpdate}
          storeUrl={updatePayload.storeUrl}
          onContinue={updatePayload.forceUpdate ? undefined : clearUpdate}
        />
      )}
    </>
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
  logo: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: SIZES.padding,
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

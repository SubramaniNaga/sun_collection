import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showAlert } from '../../utils/alertService';
import { safeGoBack } from '../../utils/navigationHelpers';
import { syncUserLanguageWithApi } from '../../utils/syncUserLanguageWithApi';

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuthContext();
  const { language, changeLanguage, t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [branchId, setBranchId] = useState(null);
  const [lineId, setLineId] = useState(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordKeyboardHeight, setPasswordKeyboardHeight] = useState(0);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const phoneAutoAdvancedRef = useRef(false);
  const currentPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const handleSave = () => {
    // In a real app, this would call the API
    updateUser(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setIsEditing(false);
  };

  useEffect(() => {
    AsyncStorage.getItem('branchId').then(setBranchId);
    AsyncStorage.getItem('lineId').then(setLineId);
  }, []);

  useEffect(() => {
    if (!showPasswordModal) {
      setPasswordKeyboardHeight(0);
      return undefined;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setPasswordKeyboardHeight(event?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setPasswordKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showPasswordModal]);

  const closePasswordModal = () => {
    Keyboard.dismiss();
    setShowPasswordModal(false);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  const displayBranch = user?.branch ?? user?.branch_id ?? branchId ?? 'N/A';
  const displayLine = user?.line ?? user?.line_name ?? lineId ?? 'N/A';
  const safeT = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const handleLanguageSelect = async (newLanguage) => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      const userId = user?.id || storedUserId;

      if (!userId) {
        showAlert({
          type: 'error',
          title: t('common.error'),
          message: t('profile.updateFailed') || 'Unable to update language. Please login again.',
        });
        return;
      }

      await syncUserLanguageWithApi(newLanguage, userId);
      await changeLanguage(newLanguage);
      updateUser({ language: newLanguage, lang: newLanguage });
      setShowLanguageModal(false);

      showAlert({
        type: 'success',
        title: t('common.success'),
        message: t('profile.language') || 'Language updated successfully',
      });
    } catch (error) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: getApiErrorMessage(
          error,
          t('profile.updateFailed') || 'Failed to change language. Please try again.',
        ),
      });
    }
  };

  const handlePasswordChange = async () => {
    if (passwordSubmitting) return;

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: t('profile.allFieldsRequired') || 'All fields are required',
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: t('profile.passwordsDoNotMatch') || 'New password and confirm password do not match',
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: t('profile.passwordMinLength') || 'Password must be at least 6 characters',
      });
      return;
    }

    const storedUserId = await AsyncStorage.getItem('userId');
    const userId = user?.id ?? storedUserId;
    if (!userId) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: t('profile.userIdMissing') || 'Could not determine your user ID. Please log in again.',
      });
      return;
    }

    try {
      setPasswordSubmitting(true);
      await apiServices.auth.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        userid: userId,
      });

      showAlert({
        type: 'success',
        title: t('common.success'),
        message: t('profile.passwordChanged') || 'Password changed successfully',
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswordModal(false);
    } catch (error) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: getApiErrorMessage(error, t('profile.passwordChangeFailed') || 'Could not change password. Please try again.'),
      });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handlePrivacyPress = () => {
    // Privacy policy URL - you can replace this with your actual privacy policy URL
    const privacyPolicyUrl = 'https://www.example.com/privacy-policy';

    Linking.canOpenURL(privacyPolicyUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(privacyPolicyUrl);
        } else {
          showAlert({
            type: 'error',
            title: t('common.error'),
            message: t('profile.cannotOpenBrowser') || 'Cannot open browser',
          });
        }
      })
      .catch((err) => {
        showAlert({
          type: 'error',
          title: t('common.error'),
          message: t('profile.cannotOpenBrowser') || 'Cannot open browser',
        });
      });
  };

  const getInitials = (name) => {
    const parts = String(name ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'U';
    return parts
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  };

  const detailRows = [
    { key: 'phone', icon: 'call-outline', label: t('common.phone'), value: user?.phone || '—' },
    { key: 'id', icon: 'id-card-outline', label: t('profile.id'), value: user?.id ?? '—' },
    { key: 'device', icon: 'phone-portrait-outline', label: t('profile.device'), value: user?.device || '—' },
    { key: 'branch', icon: 'business-outline', label: t('profile.branch'), value: displayBranch || '—' },
    { key: 'line', icon: 'git-branch-outline', label: t('profile.line'), value: displayLine || '—' },
  ];

  const languages = [
    { code: 'en', name: t('profile.english'), nativeName: 'English' },
    { code: 'ta', name: t('profile.tamil'), nativeName: 'தமிழ்' },
  ];

  const menuItems = [

    {
      id: 'language',
      title: t('profile.language'),
      icon: 'language-outline',
      onPress: () => {
        setShowLanguageModal(true);
      },
    },
    {
      id: 'change-password',
      title: t('profile.changePassword'),
      icon: 'lock-closed-outline',
      onPress: () => {
        setShowPasswordModal(true);
      },
    },

    // {
    //   id: 'privacy',
    //   title: t('profile.privacySettings'),
    //   icon: 'shield-checkmark-outline',
    //   onPress: handlePrivacyPress,
    // },
    // {
    //   id: 'help',
    //   title: t('profile.helpSupport'),
    //   icon: 'help-circle-outline',
    //   onPress: () => console.log('Navigate to help'),
    // },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />

      <Header
        title={t('profile.title')}
        showBackButton={true}
        onBackPress={() => safeGoBack(navigation)}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {getInitials(user?.name)}
              </Text>
            </View>
            <Text style={styles.profileName}>
              {user?.name || t('profile.user')}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {user?.role === '1' ? t('profile.collectionAgent') : user?.role || t('profile.collectionAgent')}
              </Text>
            </View>
          </View>
          <View style={styles.profileDetails}>
            {detailRows.map((row, index) => (
              <View
                key={row.key}
                style={[
                  styles.detailRow,
                  index === detailRows.length - 1 && styles.detailRowLast,
                ]}
              >
                <View style={styles.detailIconWrap}>
                  <Ionicons name={row.icon} size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={styles.detailValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Edit Form */}
        {isEditing && (
          <Card style={styles.editCard}>
            <Text style={styles.editTitle}>{t('profile.editProfile')}</Text>

            <Input
              ref={firstNameRef}
              label={t('profile.firstName')}
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              style={styles.input}
              returnKeyType="next"
              blurOnSubmit={false}
              submitBehavior="submit"
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />

            <Input
              ref={lastNameRef}
              label={t('profile.lastName')}
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              style={styles.input}
              returnKeyType="next"
              blurOnSubmit={false}
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />

            <Input
              ref={emailRef}
              label={t('profile.email')}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              returnKeyType="next"
              blurOnSubmit={false}
              submitBehavior="submit"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />

            <Input
              ref={phoneRef}
              label={t('profile.phone')}
              value={formData.phone}
              onChangeText={(text) => {
                const numericValue = String(text || '').replace(/[^0-9]/g, '').slice(0, 10);
                setFormData({ ...formData, phone: numericValue });
                if (numericValue.length === 10 && !phoneAutoAdvancedRef.current) {
                  phoneAutoAdvancedRef.current = true;
                  Keyboard.dismiss();
                }
                if (numericValue.length < 10) {
                  phoneAutoAdvancedRef.current = false;
                }
              }}
              keyboardType="phone-pad"
              maxLength={10}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <View style={styles.buttonRow}>
              <Button
                title={t('common.cancel')}
                onPress={handleCancel}
                variant="outline"
                style={styles.cancelButton}
              />
              <Button
                title={t('common.save')}
                onPress={handleSave}
                style={styles.saveButton}
              />
            </View>
          </Card>
        )}

        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && styles.menuItemLast,
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name={item.icon} size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguageModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="language" size={18} color={COLORS.white} />
                </View>
                <Text style={styles.modalTitle}>{t('profile.selectLanguage')}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowLanguageModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.languageOptions}>
              {languages.map((lang, index) => {
                const isSelected = language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.languageOption,
                      isSelected && styles.languageOptionSelected,
                      index === languages.length - 1 && styles.languageOptionLast
                    ]}
                    onPress={() => handleLanguageSelect(lang.code)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.languageContent}>
                      <View style={[
                        styles.languageIconContainer,
                        isSelected && styles.languageIconContainerSelected
                      ]}>
                        <Ionicons
                          name={lang.code === 'en' ? "globe-outline" : "book-outline"}
                          size={20}
                          color={isSelected ? COLORS.white : COLORS.primary}
                        />
                      </View>
                      <View style={styles.languageTextContainer}>
                        <Text style={[
                          styles.languageName,
                          isSelected && styles.languageNameSelected
                        ]}>
                          {lang.name}
                        </Text>
                        <Text style={[
                          styles.languageNativeName,
                          isSelected && styles.languageNativeNameSelected
                        ]}>
                          {lang.nativeName}
                        </Text>
                      </View>
                    </View>
                    <View style={[
                      styles.checkmarkContainer,
                      isSelected && styles.checkmarkContainerSelected
                    ]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color={COLORS.white} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closePasswordModal}
      >
        <View style={styles.passwordSheetOverlay}>
          <Pressable style={styles.passwordSheetDismiss} onPress={closePasswordModal} />
          <View
            style={[
              styles.passwordSheet,
              {
                marginBottom: passwordKeyboardHeight,
                paddingBottom: passwordKeyboardHeight > 0 ? 12 : Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.passwordSheetTop}>
            <View style={styles.passwordSheetHandle} />
            <View style={[styles.modalHeader, styles.passwordSheetHeader]}>
              <View style={styles.modalHeaderContent}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="lock-closed" size={18} color={COLORS.white} />
                </View>
                <Text style={styles.modalTitle}>
                  {t('profile.changePassword')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closePasswordModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.white} />
              </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.passwordModalScroll}
              contentContainerStyle={styles.passwordModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
                {/* Current Password */}
                <View style={styles.passwordInputContainer}>
                  <Text style={styles.passwordLabel}>
                    {t('profile.currentPassword')}
                  </Text>
                  <View style={styles.passwordInputWrapper}>
                    <View style={styles.passwordInputField}>
                      <TextInput
                        ref={currentPasswordRef}
                        style={styles.passwordInput}
                        value={passwordData.currentPassword}
                        onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
                        secureTextEntry={!!passwordData.currentPassword && !showPasswords.current}
                        autoCapitalize="none"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        submitBehavior="submit"
                        onSubmitEditing={() => newPasswordRef.current?.focus()}
                      />
                      {!passwordData.currentPassword ? (
                        <View style={styles.passwordPlaceholderWrap} pointerEvents="none">
                          <Text style={styles.passwordPlaceholder}>
                            {t('profile.enterCurrentPassword')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    >
                      <Ionicons
                        name={showPasswords.current ? "eye-outline" : "eye-off-outline"}
                        size={22}
                        color={COLORS.text.tertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* New Password */}
                <View style={styles.passwordInputContainer}>
                  <Text style={styles.passwordLabel}>
                    {t('profile.newPassword')}
                  </Text>
                  <View style={styles.passwordInputWrapper}>
                    <View style={styles.passwordInputField}>
                      <TextInput
                        ref={newPasswordRef}
                        style={styles.passwordInput}
                        value={passwordData.newPassword}
                        onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
                        secureTextEntry={!!passwordData.newPassword && !showPasswords.new}
                        autoCapitalize="none"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        submitBehavior="submit"
                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                      />
                      {!passwordData.newPassword ? (
                        <View style={styles.passwordPlaceholderWrap} pointerEvents="none">
                          <Text style={styles.passwordPlaceholder}>
                            {t('profile.enterNewPassword')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    >
                      <Ionicons
                        name={showPasswords.new ? "eye-outline" : "eye-off-outline"}
                        size={22}
                        color={COLORS.text.tertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.passwordInputContainer}>
                  <Text style={styles.passwordLabel}>
                    {t('profile.confirmPassword')}
                  </Text>
                  <View style={styles.passwordInputWrapper}>
                    <View style={styles.passwordInputField}>
                      <TextInput
                        ref={confirmPasswordRef}
                        style={styles.passwordInput}
                        value={passwordData.confirmPassword}
                        onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                        secureTextEntry={!!passwordData.confirmPassword && !showPasswords.confirm}
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                      {!passwordData.confirmPassword ? (
                        <View style={styles.passwordPlaceholderWrap} pointerEvents="none">
                          <Text style={styles.passwordPlaceholder}>
                            {t('profile.confirmNewPassword')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    >
                      <Ionicons
                        name={showPasswords.confirm ? "eye-outline" : "eye-off-outline"}
                        size={22}
                        color={COLORS.text.tertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.passwordButtonRow}>
                  <TouchableOpacity
                    style={[styles.passwordButton, styles.passwordButtonCancel]}
                    disabled={passwordSubmitting}
                    onPress={closePasswordModal}
                  >
                    <Text style={styles.passwordButtonCancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.passwordButton, styles.passwordButtonSubmit, passwordSubmitting && styles.passwordButtonSubmitDisabled]}
                    onPress={handlePasswordChange}
                    disabled={passwordSubmitting}
                  >
                    {passwordSubmitting ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <Text style={styles.passwordButtonSubmitText}>{t('common.save')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  scrollContent: {
    paddingBottom: SIZES.padding * 2,
  },
  profileCard: {
    margin: SIZES.padding,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  profileTop: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: SIZES.padding,
  },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.white,
  },
  profileName: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  roleBadgeText: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  profileDetails: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6EBF2',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailLabel: {
    fontSize: SIZES.body4,
    color: '#6B7280',
    width: 88,
    marginTop: 6,
  },
  detailValue: {
    flex: 1,
    fontSize: SIZES.body3,
    color: COLORS.black,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 6,
  },
  detailRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  infoIconButton: {
    paddingLeft: SIZES.base,
    paddingVertical: SIZES.base / 2,
  },
  editCard: {
    margin: SIZES.padding,
    padding: SIZES.padding * 2,
    marginBottom: SIZES.padding * 2,
  },
  editTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SIZES.padding,
    textAlign: 'center',
  },
  input: {
    marginBottom: SIZES.margin,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SIZES.margin,
  },
  cancelButton: {
    flex: 1,
    marginRight: SIZES.margin,
  },
  saveButton: {
    flex: 1,
  },
  infoCard: {
    margin: SIZES.padding,
    padding: SIZES.padding * 2,
    marginBottom: SIZES.padding * 2,
  },
  infoTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SIZES.padding,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.margin,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
  },
  statusText: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  menuSection: {
    marginHorizontal: SIZES.padding,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6EBF2',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTitle: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.black,
    fontWeight: '600',
  },
  passwordSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  passwordSheetDismiss: {
    flex: 1,
  },
  passwordSheet: {
    width: '100%',
    maxHeight: '92%',
    flexShrink: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  passwordSheetTop: {
    backgroundColor: COLORS.primary,
  },
  passwordSheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    marginTop: 10,
  },
  passwordSheetHeader: {
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  modalIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modalTitle: {
    flex: 1,
    fontSize: SIZES.body1,
    fontWeight: '700',
    color: COLORS.white,
    lineHeight: 26,
  },
  closeButton: {
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
  },
  languageOptions: {
    padding: 16,
    gap: 10,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  languageOptionSelected: {
    backgroundColor: '#E8F3FC',
    borderColor: COLORS.primary,
  },
  languageOptionLast: {
    marginBottom: 0,
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  languageIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F3FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  languageIconContainerSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageName: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  languageNameSelected: {
    fontWeight: '700',
    color: COLORS.primary,
    fontSize: SIZES.body1 + 1,
  },
  languageNativeName: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    fontWeight: '500',
  },
  languageNativeNameSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  checkmarkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkContainerSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  passwordModalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  passwordModalScrollContent: {
    padding: 16,
    paddingBottom: 8,
  },
  passwordInputContainer: {
    marginBottom: SIZES.margin * 1.5,
  },
  passwordLabel: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.base,
    lineHeight: 22,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    paddingHorizontal: 12,
    minHeight: 64,
    paddingVertical: 10,
  },
  passwordInputField: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  passwordInput: {
    fontSize: SIZES.body2,
    color: COLORS.black,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    minHeight: 24,
    textAlignVertical: 'center',
  },
  passwordPlaceholderWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  passwordPlaceholder: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text.tertiary,
  },
  eyeIcon: {
    padding: SIZES.base / 2,
  },
  passwordButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SIZES.margin * 2,
    gap: SIZES.margin,
  },
  passwordButton: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordButtonCancel: {
    backgroundColor: '#F4F6F9',
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  passwordButtonCancelText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  passwordButtonSubmit: {
    backgroundColor: COLORS.primary,
  },
  passwordButtonSubmitDisabled: {
    opacity: 0.85,
  },
  passwordButtonSubmitText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.white,
    lineHeight: 22,
    textAlign: 'center',
  },
});

export default ProfileScreen;

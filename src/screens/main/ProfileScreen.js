import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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

  const displayBranch = user?.branch ?? user?.branch_id ?? branchId ?? 'N/A';
  const displayLine = user?.line ?? user?.line_name ?? lineId ?? 'N/A';
  const truncateText = (value, maxLength = 24) => {
    if (!value) return '';
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  };
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
      console.error('Error changing language:', error);
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: error?.response?.data?.message || 'Failed to change language. Please try again.',
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
      console.error('Change password error:', error);
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
        console.error('Error opening privacy policy:', err);
        showAlert({
          type: 'error',
          title: t('common.error'),
          message: t('profile.cannotOpenBrowser') || 'Cannot open browser',
        });
      });
  };

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
        onBackPress={() => navigation.goBack()} 
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
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
          <View style={styles.profileDivider} />
          <View style={styles.profileDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={18} color={COLORS.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>{t('common.phone')}</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{user?.phone || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="id-card-outline" size={18} color={COLORS.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>{t('profile.id')}</Text>
              <Text style={styles.detailValue}>{user?.id ?? 'N/A'}</Text>
            </View>
            {/* <View style={styles.detailRow}>
              <Ionicons name="phone-portrait-outline" size={18} color={COLORS.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>{t('profile.device')}</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{user?.device || 'N/A'}</Text>
            </View> */}
            <View style={styles.detailRow}>
              <Ionicons name="business-outline" size={18} color={COLORS.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>{t('profile.branch')}</Text>
              <Text style={styles.detailValue}>{displayBranch}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="git-branch-outline" size={18} color={COLORS.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>{t('profile.line')}</Text>
              <Text style={styles.detailValue}>{displayLine}</Text>
            </View>
          </View>
        </Card>

        {/* Edit Form */}
        {isEditing && (
          <Card style={styles.editCard}>
            <Text style={styles.editTitle}>{t('profile.editProfile')}</Text>
            
            <Input
              label={t('profile.firstName')}
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              style={styles.input}
            />
            
            <Input
              label={t('profile.lastName')}
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              style={styles.input}
            />
            
            <Input
              label={t('profile.email')}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            
            <Input
              label={t('profile.phone')}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
              style={styles.input}
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

        {/* Menu Options */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuContent}>
            <Ionicons name={item.icon} size={20} color={COLORS.primary} style={styles.menuIcon} />
                <Text style={styles.menuTitle}>{item.title}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
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
                  <Ionicons name="language" size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.modalTitle}>{t('profile.selectLanguage')}</Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setShowLanguageModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={28} color={COLORS.text.tertiary} />
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
                          size={28} 
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

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.passwordModalKeyboardRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowPasswordModal(false)}
          >
            <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderContent}>
                  <View style={styles.modalIconContainer}>
                    <Ionicons name="lock-closed" size={28} color={COLORS.primary} />
                  </View>
                  <Text style={styles.modalTitle} numberOfLines={1} ellipsizeMode="tail">
                    {truncateText(t('profile.changePassword') || 'Change Password', 18)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowPasswordModal(false);
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: '',
                    });
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={28} color={COLORS.text.tertiary} />
                </TouchableOpacity>
              </View>

              <KeyboardAwareScrollView
                style={styles.passwordModalScroll}
                contentContainerStyle={styles.passwordModalScrollContent}
                showsVerticalScrollIndicator={false}
                enableOnAndroid
                enableAutomaticScroll
                keyboardShouldPersistTaps="handled"
                extraScrollHeight={Platform.OS === 'android' ? 140 : 100}
                extraHeight={120}
                nestedScrollEnabled
              >
              {/* Current Password */}
              <View style={styles.passwordInputContainer}>
                <Text style={styles.passwordLabel} numberOfLines={1} ellipsizeMode="tail">
                  {truncateText(t('profile.currentPassword') || 'Current Password', 24)}
                </Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={truncateText(t('profile.enterCurrentPassword') || 'Enter current password', 18)}
                    placeholderTextColor={COLORS.text.tertiary}
                    value={passwordData.currentPassword}
                    onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
                    secureTextEntry={!showPasswords.current}
                    autoCapitalize="none"
                  />
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
                <Text style={styles.passwordLabel} numberOfLines={1} ellipsizeMode="tail">
                  {truncateText(t('profile.newPassword') || 'New Password', 24)}
                </Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={truncateText(t('profile.enterNewPassword') || 'Enter new password', 18)}
                    placeholderTextColor={COLORS.text.tertiary}
                    value={passwordData.newPassword}
                    onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
                    secureTextEntry={!showPasswords.new}
                    autoCapitalize="none"
                  />
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
                <Text style={styles.passwordLabel} numberOfLines={1} ellipsizeMode="tail">
                  {truncateText(t('profile.confirmPassword') || 'Confirm Password', 24)}
                </Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={truncateText(t('profile.confirmNewPassword') || 'Confirm new password', 18)}
                    placeholderTextColor={COLORS.text.tertiary}
                    value={passwordData.confirmPassword}
                    onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                    secureTextEntry={!showPasswords.confirm}
                    autoCapitalize="none"
                  />
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
                  onPress={() => {
                    setShowPasswordModal(false);
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: '',
                    });
                  }}
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
              </KeyboardAwareScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SIZES.padding * 2, // Add bottom padding to avoid navigation bar overlap
  },
  profileCard: {
    margin: SIZES.padding,
    padding: 0,
    marginBottom: SIZES.padding * 1.5,
    overflow: 'hidden',
  },
  profileTop: {
    alignItems: 'center',
    paddingVertical: SIZES.padding * 1.5,
    paddingHorizontal: SIZES.padding,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.margin,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.white,
  },
  profileName: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  roleBadge: {
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius * 2,
  },
  roleBadgeText: {
    fontSize: SIZES.body3,
    color: COLORS.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  profileDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SIZES.padding,
  },
  profileDetails: {
    paddingVertical: SIZES.margin,
    paddingHorizontal: SIZES.padding,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailIcon: {
    marginRight: SIZES.base,
    width: 24,
  },
  detailLabel: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    width: 110,
  },
  detailValue: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
    fontWeight: '500',
    textAlign: 'right',
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
    margin: SIZES.padding,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: SIZES.margin,
  },
  menuTitle: {
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: SIZES.h2,
    color: COLORS.text.tertiary,
  },
  passwordModalKeyboardRoot: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 3,
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.padding * 1.5,
    backgroundColor: COLORS.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.margin,
  },
  modalTitle: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.text.primary,
    flex: 1,
    marginRight: SIZES.base,
  },
  closeButton: {
    padding: SIZES.base / 2,
    borderRadius: SIZES.radius,
  },
  languageOptions: {
    padding: SIZES.padding,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.padding * 1.5,
    marginBottom: SIZES.margin,
    borderRadius: SIZES.radius * 2,
    backgroundColor: COLORS.lightGray,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  languageOptionSelected: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
    borderWidth: 2,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.margin,
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
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
    maxHeight: 420,
  },
  passwordModalScrollContent: {
    padding: SIZES.padding * 1.5,
    paddingBottom: SIZES.padding * 3,
  },
  passwordInputContainer: {
    marginBottom: SIZES.margin * 1.5,
  },
  passwordLabel: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.base,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius * 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SIZES.padding,
    height: 50,
  },
  passwordInput: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.black,
    paddingVertical: SIZES.base,
    textAlignVertical: 'center',
    includeFontPadding: false,
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
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordButtonCancel: {
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  passwordButtonCancelText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.secondary,
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
  },
});

export default ProfileScreen;

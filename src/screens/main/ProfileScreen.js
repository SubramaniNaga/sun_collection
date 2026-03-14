import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';
import { showAlert } from '../../utils/alertService';

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuthContext();
  const { language, changeLanguage, t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [branchId, setBranchId] = useState(null);
  const [lineId, setLineId] = useState(null);
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

  const handleLanguageChange = (newLanguage) => {
    showAlert({
      type: 'info',
      title: t('profile.selectLanguage'),
      message: t('profile.selectLanguage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.ok'), onPress: () => changeLanguage(newLanguage) },
      ],
    });
  };

  const menuItems = [
   
    {
      id: 'language',
      title: t('profile.language'),
      icon: 'language-outline',
      onPress: () => {
        showAlert({
          type: 'info',
          title: t('profile.selectLanguage'),
          message: '',
          buttons: [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('profile.english'), onPress: () => changeLanguage('en') },
            { text: t('profile.tamil'), onPress: () => changeLanguage('ta') },
          ],
        });
      },
    },
    {
      id: 'change-password',
      title: t('profile.changePassword'),
      icon: 'lock-closed-outline',
      onPress: () => console.log('Navigate to change password'),
    },
   
    {
      id: 'privacy',
      title: t('profile.privacySettings'),
      icon: 'shield-checkmark-outline',
      onPress: () => console.log('Navigate to privacy'),
    },
    {
      id: 'help',
      title: t('profile.helpSupport'),
      icon: 'help-circle-outline',
      onPress: () => console.log('Navigate to help'),
    },
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
            <View style={styles.detailRow}>
              <Ionicons name="phone-portrait-outline" size={18} color={COLORS.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>{t('profile.device')}</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{user?.device || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="business-outline" size={18} color={COLORS.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>{t('profile.branch')}</Text>
              <Text style={styles.detailValue}>{displayBranch}</Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowLast]}>
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
    width: 90,
  },
  detailValue: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
    fontWeight: '500',
    textAlign: 'right',
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
});

export default ProfileScreen;

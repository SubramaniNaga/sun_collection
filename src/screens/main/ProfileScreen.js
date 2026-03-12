import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuthContext();
  const { language, changeLanguage, t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
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

  const handleLanguageChange = (newLanguage) => {
    Alert.alert(
      t('profile.selectLanguage'),
      t('profile.selectLanguage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.ok'),
          onPress: () => changeLanguage(newLanguage),
        },
      ]
    );
  };

  const menuItems = [
   
    {
      id: 'language',
      title: t('profile.language'),
      icon: 'language-outline',
      onPress: () => {
        Alert.alert(
          t('profile.selectLanguage'),
          '',
          [
            {
              text: t('common.cancel'),
              style: 'cancel',
            },
            {
              text: t('profile.english'),
              onPress: () => changeLanguage('en'),
            },
            {
              text: t('profile.tamil'),
              onPress: () => changeLanguage('ta'),
            },
          ],
          { cancelable: true }
        );
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      
      <Header 
        title={t('profile.title')} 
        showBackButton={true}
        onBackPress={() => navigation.goBack()} 
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}editProfile
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.name || t('profile.user')}
              </Text>
              <Text style={styles.profileRole}>
                {user?.role === '1' ? t('profile.collectionAgent') : user?.role || t('profile.collectionAgent')}
              </Text>
              <Text style={styles.profileId}>
                {t('common.phone')}: {user?.phone || 'N/A'}
              </Text>
              <Text style={styles.profileId}>
                {t('profile.id')}: {user?.id || 'N/A'}
              </Text>
              <Text style={styles.profileId}>
                {t('profile.device')}: {user?.device || 'N/A'}
              </Text>
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

        {/* Profile Information */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t('profile.profileInformation')}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('profile.email')}</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('profile.phone')}</Text>
            <Text style={styles.infoValue}>{user?.phone}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('profile.region')}</Text>
            <Text style={styles.infoValue}>{user?.assignedRegionId || t('profile.notAssigned')}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('profile.joiningDate')}</Text>
            <Text style={styles.infoValue}>{user?.joiningDate || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('profile.accountStatus')}</Text>
            <View style={[styles.statusBadge, { backgroundColor: user?.accountStatus === 'ACTIVE' ? COLORS.primary : COLORS.secondary }]}>
              <Text style={styles.statusText}>{user?.accountStatus === 'ACTIVE' ? t('profile.active') : t('profile.unknown')}</Text>
            </View>
          </View>
        </Card>

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
    padding: SIZES.padding * 2,
    marginBottom: SIZES.padding * 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.padding * 1.5,
  },
  avatarText: {
    fontSize: SIZES.h1,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  profileRole: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 2,
    textTransform: 'capitalize',
  },
  profileId: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
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

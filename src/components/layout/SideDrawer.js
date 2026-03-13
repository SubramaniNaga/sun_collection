import React from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';

const SideDrawer = ({ isVisible, onClose, navigation }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthContext();

  const menuItems = [
    {
      id: 'home',
      title: t('home.title'),
      icon: '🏠',
      onPress: () => {
        navigation.navigate('Home');
        onClose();
      },
    },
    {
      id: 'profile',
      title: t('profile.title'),
      icon: '👤',
      onPress: () => {
        navigation.navigate('Profile');
        onClose();
      },
    },
    {
      id: 'settings',
      title: t('settings.title'),
      icon: '⚙️',
      onPress: () => {
        navigation.navigate('Settings');
        onClose();
      },
    },
    {
      id: 'logout',
      title: t('settings.logout'),
      icon: '🚪',
      onPress: () => {
        Alert.alert(
          t('settings.confirmLogout'),
          null,
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.confirmLogoutConfirm'),
              onPress: async () => {
                await logout();
                onClose();
              },
            },
          ]
        );
      },
      isDestructive: true,
    },
  ];

  if (!isVisible) return null;

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={[styles.drawer, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text style={styles.userRole}>
                {user?.role?.replace('_', ' ') || t('profile.collectionAgent')}
              </Text>
              <Text style={styles.userEmail}>
                {user?.email}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, item.isDestructive && styles.menuItemDestructive]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuIcon, item.isDestructive && styles.menuIconDestructive]}>
                {item.icon}
              </Text>
              <Text style={[styles.menuTitle, item.isDestructive && styles.menuTitleDestructive]}>
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('settings.collectionAgentApp')} v1.0.0
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    width: 280,
    backgroundColor: COLORS.white,
    ...SHADOWS.large,
  },
  header: {
    padding: SIZES.padding * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.margin,
  },
  avatarText: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: SIZES.body2,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  userRole: {
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  userEmail: {
    fontSize: SIZES.body4,
    color: COLORS.text.tertiary,
  },
  menuContainer: {
    flex: 1,
    paddingVertical: SIZES.padding,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding * 2,
  },
  menuItemDestructive: {
    backgroundColor: '#FFEBEE',
  },
  menuIcon: {
    fontSize: SIZES.h3,
    marginRight: SIZES.margin,
    width: 24,
    textAlign: 'center',
  },
  menuIconDestructive: {
    color: COLORS.error,
  },
  menuTitle: {
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  menuTitleDestructive: {
    color: COLORS.error,
  },
  footer: {
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  footerText: {
    fontSize: SIZES.body4,
    color: COLORS.text.tertiary,
  },
});

export default SideDrawer;

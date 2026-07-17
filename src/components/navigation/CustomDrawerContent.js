import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LogoutModal from '../../components/common/LogoutModal';
import { APP_VERSION } from '../../constants/appVersion';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';

const CustomDrawerContent = (props) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthContext();
  const { navigation, state } = props;
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const menuItems = [
    {
      id: 'home',
      label: t('home.title'),
      icon: 'home-outline',
      onPress: () => navigation.navigate('Home'),
    },
    {
      id: 'profile',
      label: t('profile.title'),
      icon: 'person-outline',
      onPress: () => navigation.navigate('Profile'),
    },
    {
      id: 'companyVaravu',
      label: t('companyVaravu.title'),
      icon: 'business-outline',
      onPress: () => navigation.navigate('Home', { screen: 'CompanyVaravuAdd' }),
    },
  ];

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const headerPadding = SIZES.padding * 1.5;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Safe area top is inside header so status-bar strip matches primary blue */}
      <View style={[styles.header, { paddingTop: insets.top + headerPadding }]}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(user?.name)}
              </Text>
            </View>
          </View>
            <View style={styles.userInfo}>
            <View style={styles.userHeader}>
              <Text style={styles.userName}>
                {user?.name || t('profile.user')}
              </Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.userEmail}>
                {user?.phone || '+1234567890'}
              </Text>
            </View>
          </View>
        </View>

      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.drawerItem,
              state?.routeNames?.[state?.index] === item.id && styles.activeDrawerItem,
            ]}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon} size={20} color={COLORS.primary} style={{ marginRight: SIZES.margin }} />
            <Text style={[
              styles.itemLabel,
              state?.routeNames?.[state?.index] === item.id && styles.activeLabel,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.primary} style={{ marginRight: SIZES.margin }} />
          <Text style={styles.logoutText}>{t('settings.logout')}</Text>
        </TouchableOpacity>
      </View>

      {/* App Version */}
      <View style={styles.footer}>
        <Text style={styles.versionText}>{t('settings.version')} {APP_VERSION}</Text>
      </View>

      {/* Logout Confirmation Modal */}
      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={async () => {
          await logout();
          setShowLogoutModal(false);
        }}
        userName={user?.name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingHorizontal: SIZES.padding * 1.5,
    paddingBottom: SIZES.padding * 1.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.primary,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.margin,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: SIZES.margin,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.white,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: SIZES.h2,
    fontWeight: '700',
    color: COLORS.white,
    flex: 1,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  roleBadgeText: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  userRole: {
    fontSize: SIZES.body3,
    color: COLORS.white,
    marginBottom: 6,
    opacity: 0.9,
    fontWeight: '500',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userEmail: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    opacity: 0.8,
    flex: 1,
  },
  separator: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    opacity: 0.6,
    marginHorizontal: 8,
  },
  userId: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    opacity: 0.8,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: SIZES.h2,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    opacity: 0.8,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: SIZES.margin,
  },
  menuSection: {
    flex: 1,
    paddingTop: SIZES.padding,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.padding,
    marginHorizontal: SIZES.margin,
    marginBottom: SIZES.base,
    borderRadius: SIZES.radius,
  },
  activeDrawerItem: {
    backgroundColor: COLORS.primary + '10',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  itemLabel: {
    fontSize: SIZES.body2,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  activeLabel: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  logoutSection: {
    padding: SIZES.padding * 0.1,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
  },
  logoutText: {
    fontSize: SIZES.body2,
    color: COLORS.primary,
    fontWeight: '600',
  },
  footer: {
    padding: SIZES.padding,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  versionText: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
});

export default CustomDrawerContent;

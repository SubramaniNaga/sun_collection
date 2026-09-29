import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import LogoutModal from '../../components/common/LogoutModal';
import { APP_VERSION } from '../../constants/appVersion';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';

const asText = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') {
    return String(value.name ?? value.branch_name ?? value.line_name ?? '').trim();
  }
  return String(value).trim();
};

const isDisplayName = (value) => {
  const text = asText(value);
  return Boolean(text) && !/^\d+$/.test(text);
};

const firstDisplayName = (...values) => {
  for (const value of values) {
    if (isDisplayName(value)) return asText(value);
  }
  return '';
};

const lineNamesFrom = (source) => {
  const fromList = (Array.isArray(source?.lines) ? source.lines : [])
    .map((line) => firstDisplayName(line?.line_name, line?.name, line?.line))
    .filter(Boolean);
  if (fromList.length) return fromList.join(', ');
  return firstDisplayName(source?.line_name, source?.lineName, source?.line);
};

const CustomDrawerContent = (props) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthContext();
  const { navigation, state } = props;
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [lineName, setLineName] = useState('');

  useEffect(() => {
    let active = true;

    const loadProfilePlace = async () => {
      let stored = {};
      try {
        const raw = await AsyncStorage.getItem('userData');
        stored = raw ? JSON.parse(raw) : {};
      } catch {
        stored = {};
      }

      const source = { ...stored, ...(user || {}) };
      if (!active) return;
      setBranchName(firstDisplayName(source.branch_name, source.branchName, source.branch));
      setLineName(lineNamesFrom(source));

      try {
        const users = await apiServices.branchUsers.getList(source.branch_id ?? source.branchId);
        if (!active) return;
        const me = (Array.isArray(users) ? users : []).find(
          (item) => String(item?.id) === String(source.id)
        );
        if (!me) return;
        const resolvedLine = lineNamesFrom(me);
        const resolvedBranch = firstDisplayName(me.branch_name, me.branchName, me.branch);
        if (resolvedLine) setLineName(resolvedLine);
        if (resolvedBranch) setBranchName(resolvedBranch);
      } catch {
        // Keep names already stored on the login profile.
      }
    };

    loadProfilePlace();
    return () => {
      active = false;
    };
  }, [user]);

  const navigateAndCloseDrawer = (action) => {
    navigation.closeDrawer();
    action();
  };

  const menuItems = [
    {
      id: 'home',
      label: t('home.title'),
      icon: 'home-outline',
      onPress: () => navigateAndCloseDrawer(() => navigation.navigate('Home', { screen: 'HomeScreen' })),
    },
    {
      id: 'profile',
      label: t('profile.title'),
      icon: 'person-outline',
      onPress: () => navigateAndCloseDrawer(() => navigation.navigate('Profile')),
    },
    {
      id: 'companyVaravu',
      label: t('companyVaravu.title'),
      icon: 'business-outline',
      onPress: () =>
        navigateAndCloseDrawer(() =>
          navigation.navigate('Home', { screen: 'CompanyVaravuAdd' })
        ),
    },
    {
      id: 'cities',
      label: t('cities.title'),
      icon: 'location-outline',
      onPress: () =>
        navigateAndCloseDrawer(() =>
          navigation.navigate('Home', { screen: 'Cities' })
        ),
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
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || t('profile.user')}
            </Text>
            <View style={styles.contactInfo}>
              <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.92)" />
              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.phone || '—'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.metaCard}>
          <View style={styles.metaItem}>
            <Ionicons name="business-outline" size={16} color={COLORS.white} />
            <View style={styles.metaTextWrap}>
              <Text style={styles.metaLabel}>{t('profile.branch')}</Text>
              <Text style={styles.metaValue}>
                {branchName || '—'}
              </Text>
            </View>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Ionicons name="git-branch-outline" size={16} color={COLORS.white} />
            <View style={styles.metaTextWrap}>
              <Text style={styles.metaLabel}>{t('profile.line')}</Text>
              <Text style={styles.metaValue}>
                {lineName || '—'}
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
            <View style={styles.itemIconWrap}>
              <Ionicons name={item.icon} size={18} color={COLORS.primary} />
            </View>
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
          <View style={styles.itemIconWrap}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.primary} />
          </View>
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
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.white,
    textTransform: 'capitalize',
    marginBottom: 4,
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
    gap: 6,
  },
  userEmail: {
    fontSize: SIZES.body4,
    color: COLORS.white,
    opacity: 0.9,
    flex: 1,
  },
  metaCard: {
    marginTop: SIZES.padding,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metaTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaValue: {
    marginTop: 2,
    fontSize: SIZES.body4,
    fontWeight: '700',
    color: COLORS.white,
    textTransform: 'capitalize',
  },
  metaDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
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
  itemIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    marginHorizontal: SIZES.margin,
    marginBottom: 6,
    borderRadius: 12,
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

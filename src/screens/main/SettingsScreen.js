import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../components/common/Card';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthContext } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';

const SettingsScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { logout } = useAuthContext();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  const settingsSections = [
    {
      title: t('settings.preferences'),
      items: [
        {
          id: 'notifications',
          title: t('settings.pushNotifications'),
          subtitle: t('settings.receiveCollectionNotifications'),
          type: 'toggle',
          value: notifications,
          onToggle: setNotifications,
        },
        {
          id: 'dark-mode',
          title: t('settings.darkMode'),
          subtitle: t('settings.useDarkTheme'),
          type: 'toggle',
          value: darkMode,
          onToggle: setDarkMode,
        },
        {
          id: 'biometric',
          title: t('settings.biometricLogin'),
          subtitle: t('settings.useFingerprintFace'),
          type: 'toggle',
          value: biometric,
          onToggle: setBiometric,
        },
        {
          id: 'auto-sync',
          title: t('settings.autoSync'),
          subtitle: t('settings.automaticallySyncData'),
          type: 'toggle',
          value: autoSync,
          onToggle: setAutoSync,
        },
      ],
    },
    {
      title: t('settings.dataStorage'),
      items: [
        {
          id: 'sync-now',
          title: t('settings.syncNow'),
          subtitle: t('settings.manuallySyncData'),
          type: 'button',
          onPress: () => console.log('Sync data'),
        },
        {
          id: 'clear-cache',
          title: t('settings.clearCache'),
          subtitle: t('settings.clearTemporaryData'),
          type: 'button',
          onPress: () => console.log('Clear cache'),
        },
        {
          id: 'export-data',
          title: t('settings.exportData'),
          subtitle: t('settings.exportYourData'),
          type: 'button',
          onPress: () => console.log('Export data'),
        },
      ],
    },
    {
      title: t('settings.support'),
      items: [
        {
          id: 'help',
          title: t('settings.helpCenter'),
          subtitle: t('settings.getHelpSupport'),
          type: 'button',
          onPress: () => console.log('Open help center'),
        },
        {
          id: 'contact',
          title: t('settings.contactSupport'),
          subtitle: t('settings.getInTouch'),
          type: 'button',
          onPress: () => console.log('Contact support'),
        },
        {
          id: 'about',
          title: t('settings.about'),
          subtitle: t('settings.appVersionInfo'),
          type: 'button',
          onPress: () => console.log('Show about'),
        },
      ],
    },
    {
      title: t('settings.account'),
      items: [
        {
          id: 'privacy',
          title: t('settings.privacyPolicy'),
          subtitle: t('settings.viewPrivacyPolicy'),
          type: 'button',
          onPress: () => console.log('Open privacy policy'),
        },
        {
          id: 'terms',
          title: t('settings.termsOfService'),
          subtitle: t('settings.viewTermsConditions'),
          type: 'button',
          onPress: () => console.log('Open terms'),
        },
        {
          id: 'logout',
          title: t('settings.logout'),
          subtitle: t('settings.signOutAccount'),
          type: 'destructive',
          onPress: () => {
            Alert.alert(
              t('settings.confirmLogout'),
              null,
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('settings.confirmLogoutConfirm'), onPress: logout },
              ]
            );
          },
        },
      ],
    },
  ];

  const renderSettingItem = (item) => {
    if (item.type === 'toggle') {
      return (
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{item.title}</Text>
            <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
          </View>
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: COLORS.border, true: COLORS.primary + '30' }}
            thumbColor={item.value ? COLORS.primary : COLORS.text.tertiary}
          />
        </View>
      );
    }

    if (item.type === 'button') {
      return (
        <TouchableOpacity style={styles.settingItem} onPress={item.onPress}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, item.type === 'destructive' && styles.destructiveTitle]}>
              {item.title}
            </Text>
            <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {settingsSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Card style={styles.sectionCard}>
              {section.items.map((item) => (
                <View key={item.id} style={styles.itemContainer}>
                  {renderSettingItem(item)}
                  {item.id !== section.items[section.items.length - 1].id && (
                    <View style={styles.divider} />
                  )}
                </View>
              ))}
            </Card>
          </View>
        ))}
        <Card style={styles.versionCard}>
          <Text style={styles.versionTitle}>{t('settings.collectionAgentApp')}</Text>
          <Text style={styles.versionNumber}>{t('settings.version')} 1.0.0</Text>
          <Text style={styles.versionBuild}>{t('settings.build')} 2024.03.01</Text>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: SIZES.padding * 2,
  },
  sectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SIZES.padding,
    paddingHorizontal: SIZES.padding,
  },
  sectionCard: {
    margin: SIZES.padding,
    padding: 0,
  },
  itemContainer: {
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding * 1.5,
  },
  settingInfo: {
    flex: 1,
    marginRight: SIZES.margin,
  },
  settingTitle: {
    fontSize: SIZES.body2,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  destructiveTitle: {
    color: COLORS.error,
  },
  settingSubtitle: {
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
  },
  settingArrow: {
    fontSize: SIZES.h2,
    color: COLORS.text.tertiary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: SIZES.padding * 1.5,
  },
  versionCard: {
    margin: SIZES.padding,
    padding: SIZES.padding * 2,
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  versionTitle: {
    fontSize: SIZES.body2,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  versionNumber: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 2,
  },
  versionBuild: {
    fontSize: SIZES.body4,
    color: COLORS.text.tertiary,
  },
});

export default SettingsScreen;

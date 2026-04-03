import { Ionicons } from '@expo/vector-icons';
import { Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';

const AppUpdateBottomSheet = ({
  visible,
  currentVersion,
  latestVersion,
  forceUpdate,
  storeUrl,
  onContinue,
}) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const openStore = () => {
    if (storeUrl) Linking.openURL(storeUrl);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!forceUpdate && onContinue) onContinue();
      }}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!forceUpdate && onContinue) onContinue();
          }}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SIZES.padding) }]}>
          <View style={styles.handle} />
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-download-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{t('auth.updateSheetTitle')}</Text>
          <Text style={styles.body}>
            {t('auth.newVersionAvailable', { version: latestVersion, currentVersion })}
          </Text>
          <View style={styles.versionRow}>
            <View style={styles.versionChip}>
              <Text style={styles.versionLabel}>{t('auth.currentVersionLabel')}</Text>
              <Text style={styles.versionValue}>{currentVersion}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={COLORS.gray} style={styles.arrow} />
            <View style={styles.versionChip}>
              <Text style={styles.versionLabel}>{t('auth.latestVersionLabel')}</Text>
              <Text style={styles.versionValue}>{latestVersion}</Text>
            </View>
          </View>
          <Text style={styles.hint}>{t('auth.updateFromStoreHint')}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={openStore} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('auth.updateNow')}</Text>
          </TouchableOpacity>
          {!forceUpdate && onContinue && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={onContinue} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>{t('auth.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2.5,
    borderTopRightRadius: SIZES.radius * 2.5,
    paddingHorizontal: SIZES.padding * 1.25,
    paddingTop: SIZES.base,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SIZES.padding,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.margin,
  },
  title: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SIZES.base,
  },
  body: {
    fontSize: SIZES.body3,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SIZES.margin,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.margin,
  },
  versionChip: {
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.padding,
    minWidth: 108,
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: SIZES.body5,
    color: COLORS.gray,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  versionValue: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  arrow: {
    marginHorizontal: SIZES.base,
  },
  hint: {
    fontSize: SIZES.body4,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: SIZES.margin,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius * 1.5,
    paddingVertical: SIZES.padding,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  secondaryBtn: {
    marginTop: SIZES.base,
    paddingVertical: SIZES.padding * 0.75,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: SIZES.body3,
    fontWeight: '500',
  },
});

export default AppUpdateBottomSheet;

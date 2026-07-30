import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { ALERT_TYPES } from '../../utils/alertService';

const ICON_MAP = {
  [ALERT_TYPES.SUCCESS]: { name: 'checkmark-circle', color: COLORS.success },
  [ALERT_TYPES.ERROR]: { name: 'close-circle', color: COLORS.error },
  [ALERT_TYPES.WARNING]: { name: 'warning', color: COLORS.warning },
  [ALERT_TYPES.INFO]: { name: 'information-circle', color: COLORS.primary },
};

const AppAlert = ({ visible, type = ALERT_TYPES.INFO, title, message, buttons = [], onClose }) => {
  const iconConfig = ICON_MAP[type] || ICON_MAP[ALERT_TYPES.INFO];
  const isSuccess = type === ALERT_TYPES.SUCCESS;
  const isError = type === ALERT_TYPES.ERROR;
  const isWarning = type === ALERT_TYPES.WARNING;

  const handlePress = (button) => {
    if (button.onPress) button.onPress();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close alert">
        <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, { backgroundColor: iconConfig.color + '20' }]}>
            <Ionicons name={iconConfig.name} size={32} color={iconConfig.color} />
          </View>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.buttonsRow}>
            {buttons.map((btn, i) => (
              <Pressable
                key={i}
                style={[
                  styles.button,
                  btn.style === 'cancel' && styles.buttonCancel,
                ]}
                onPress={() => handlePress(btn)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    btn.style === 'cancel' && styles.buttonTextCancel,
                    btn.style !== 'cancel' && isError && styles.buttonTextError,
                    btn.style !== 'cancel' && isSuccess && styles.buttonTextSuccess,
                    btn.style !== 'cancel' && isWarning && styles.buttonTextWarning,
                  ]}
                >
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  box: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.padding * 0.85,
    minWidth: 260,
    maxWidth: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.base,
  },
  title: {
    fontSize: SIZES.font.large,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 2,
    textAlign: 'center',
  },
  message: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginBottom: SIZES.padding,
    lineHeight: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  button: {
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.base,
    minWidth: 60,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.primary,
  },
  buttonCancel: {
    backgroundColor: COLORS.lightGray,
  },
  buttonText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.white,
  },
  buttonTextCancel: {
    color: '#333333',
  },
  buttonTextError: {
    color: COLORS.white,
  },
  buttonTextSuccess: {
    color: COLORS.white,
  },
  buttonTextWarning: {
    color: COLORS.white,
  },
});

export default AppAlert;

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { ALERT_TYPES } from '../../utils/alertService';

const TYPE_CONFIG = {
  [ALERT_TYPES.SUCCESS]: {
    icon: 'checkmark-circle',
    color: COLORS.success,
    headerBg: '#E8F8EE',
    buttonBg: COLORS.success,
  },
  [ALERT_TYPES.ERROR]: {
    icon: 'close-circle',
    color: COLORS.error,
    headerBg: '#FFEBEA',
    buttonBg: COLORS.error,
  },
  [ALERT_TYPES.WARNING]: {
    icon: 'warning',
    color: COLORS.warning,
    headerBg: '#FFF4E5',
    buttonBg: COLORS.warning,
  },
  [ALERT_TYPES.INFO]: {
    icon: 'information-circle',
    color: COLORS.primary,
    headerBg: '#E8F2FD',
    buttonBg: COLORS.primary,
  },
};

const AppAlert = ({ visible, type = ALERT_TYPES.INFO, title, message, buttons = [], onClose }) => {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG[ALERT_TYPES.INFO];
  const actionButtons = buttons.length > 0 ? buttons : [{ text: 'OK' }];
  const hasMultipleButtons = actionButtons.length > 1;

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
        <Pressable style={styles.container} onPress={(event) => event.stopPropagation()}>
          <View style={[styles.header, { backgroundColor: config.headerBg }]}>
            <View style={[styles.iconWrap, { backgroundColor: config.color + '20' }]}>
              <Ionicons name={config.icon} size={28} color={config.color} />
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {title || 'Notice'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>

          {message ? (
            <View style={styles.content}>
              <Text style={styles.message}>{message}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            {actionButtons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isPrimary = !isCancel && (hasMultipleButtons || actionButtons.length === 1);

              return (
                <Pressable
                  key={`${btn.text}-${index}`}
                  style={[
                    styles.actionButton,
                    hasMultipleButtons ? styles.actionButtonHalf : styles.actionButtonFull,
                    isCancel && styles.cancelButton,
                    isPrimary && { backgroundColor: config.buttonBg },
                  ]}
                  onPress={() => handlePress(btn)}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      isCancel && styles.cancelButtonText,
                      isPrimary && styles.primaryButtonText,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 1.5,
  },
  container: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 3,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 1.25,
    paddingVertical: SIZES.padding * 1.25,
    gap: SIZES.base,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.text.secondary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white + 'CC',
  },
  content: {
    paddingHorizontal: SIZES.padding * 1.5,
    paddingTop: SIZES.padding * 1.25,
    paddingBottom: SIZES.padding,
  },
  message: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    lineHeight: 24,
    textAlign: 'left',
  },
  actions: {
    flexDirection: 'row',
    padding: SIZES.padding * 1.25,
    gap: SIZES.margin,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonFull: {
    flex: 1,
  },
  actionButtonHalf: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButtonText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  cancelButtonText: {
    color: COLORS.text.secondary,
  },
  primaryButtonText: {
    color: COLORS.white,
  },
});

export default AppAlert;

import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';

const LogoutModal = ({ visible, onClose, onConfirm, userName }) => {
  const { t } = useLanguage();
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="log-out-outline" size={32} color={COLORS.error} />
            </View>
            <Text style={styles.modalTitle}>{t('settings.confirmLogout') || 'Confirm Logout'}</Text>
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>
              {t('settings.logoutConfirmationMessage') || 'Are you sure you want to logout?'}
            </Text>
            {userName && (
              <Text style={styles.userNameText}>
                {userName}
              </Text>
            )}
            <Text style={styles.modalSubMessage}>
              {t('settings.logoutSubMessage') || 'You will need to login again to access your account.'}
            </Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel') || 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out" size={20} color={COLORS.white} style={styles.confirmIcon} />
              <Text style={styles.confirmButtonText}>{t('settings.confirmLogoutConfirm') || 'Logout'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    maxWidth: 400,
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
    alignItems: 'center',
    paddingTop: SIZES.padding * 2,
    paddingBottom: SIZES.padding,
    paddingHorizontal: SIZES.padding * 1.5,
    backgroundColor: COLORS.lightGray,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.margin,
  },
  modalTitle: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  modalContent: {
    padding: SIZES.padding * 2,
    alignItems: 'center',
  },
  modalMessage: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SIZES.base,
  },
  userNameText: {
    fontSize: SIZES.body2,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SIZES.margin,
  },
  modalSubMessage: {
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    padding: SIZES.padding * 1.5,
    gap: SIZES.margin,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius * 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  confirmButton: {
    backgroundColor: COLORS.error,
  },
  confirmButtonText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.white,
    marginLeft: SIZES.base / 2,
  },
  confirmIcon: {
    marginRight: 0,
  },
});

export default LogoutModal;

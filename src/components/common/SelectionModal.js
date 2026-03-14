import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const SelectionModal = ({ visible, onClose, options, title }) => {
  const handleOptionPress = (option) => {
    option.onPress();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.optionButton}
                onPress={() => handleOptionPress(option)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <Ionicons 
                    name={option.icon || 'chevron-forward'} 
                    size={24} 
                    color={option.iconColor || COLORS.primary} 
                  />
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    {option.description && (
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    width: '100%',
    maxWidth: 320,
    maxHeight: '80%',
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.black,
  },
  closeButton: {
    padding: SIZES.base / 2,
  },
  optionsContainer: {
    paddingVertical: SIZES.base,
  },
  optionButton: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: SIZES.margin,
  },
  optionTitle: {
    fontSize: SIZES.body1,
    fontWeight: '500',
    color: COLORS.black,
  },
  optionDescription: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    marginTop: SIZES.base / 4,
  },
});

export default SelectionModal;

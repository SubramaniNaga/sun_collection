import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Full-screen image preview modal.
 *
 * Props:
 *   visible  {boolean}        - controls modal visibility
 *   uri      {string|null}    - image URI (local file:// or remote http://)
 *   title    {string}         - label shown in the header
 *   onClose  {() => void}     - called when the user dismisses the modal
 */
const ImagePreviewModal = ({ visible, uri, title = '', onClose }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    statusBarTranslucent
    onRequestClose={onClose}
  >
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={26} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Image */}
        <View style={styles.imageWrap}>
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.4)" />
              <Text style={styles.placeholderText}>Image not available</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
  },
  title: {
    flex: 1,
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.white,
    marginRight: SIZES.base,
  },
  closeBtn: {
    padding: SIZES.base,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  imageWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  image: {
    width: SCREEN_WIDTH - SIZES.padding * 2,
    height: SCREEN_HEIGHT * 0.75,
  },
  placeholder: {
    alignItems: 'center',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: SIZES.body2,
    marginTop: SIZES.base,
  },
});

export default ImagePreviewModal;

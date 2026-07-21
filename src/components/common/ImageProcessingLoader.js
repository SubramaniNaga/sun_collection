import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const ImageProcessingLoader = ({
  message = 'Processing image...',
  style,
}) => (
  <View style={[styles.overlay, style]}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text style={styles.message}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  message: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    marginTop: SIZES.base,
    textAlign: 'center',
  },
});

export default ImageProcessingLoader;

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { useLoading } from '../../store/LoadingContext';

const GlobalLoader = () => {
  const { globalLoading } = useLoading();

  if (!globalLoading) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.loaderContainer}>
        <ActivityIndicator 
          size="large" 
          color={COLORS.primary} 
          style={styles.spinner}
        />
        <Text style={styles.loadingText}>
          Loading...
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loaderContainer: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding * 2,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  spinner: {
    marginBottom: SIZES.margin,
  },
  loadingText: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
});

export default GlobalLoader;

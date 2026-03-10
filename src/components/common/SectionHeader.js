import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const SectionHeader = ({ title, subtitle, showMore = false, onMorePress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {showMore && (
        <TouchableOpacity style={styles.moreButton} onPress={onMorePress}>
          <Text style={styles.moreButtonText}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.padding,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  subtitle: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
  },
  moreButton: {
    paddingVertical: SIZES.base / 2,
    paddingHorizontal: SIZES.padding,
  },
  moreButtonText: {
    fontSize: SIZES.body3,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default SectionHeader;

import { StyleSheet, View } from 'react-native';
import { SIZES } from '../../constants/theme';
import ListSkeleton from './ListSkeleton';

/**
 * Footer for infinite-scroll lists: reserves space when more pages exist,
 * shows skeleton as soon as pagination starts (natural scroll reveals loader).
 */
const PaginationListFooter = ({ loadingMore, hasNextPage, skeletonCount = 2 }) => {
  if (!hasNextPage && !loadingMore) {
    return null;
  }

  return (
    <View style={styles.footer}>
      {loadingMore ? <ListSkeleton count={skeletonCount} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    minHeight: 160,
    paddingVertical: SIZES.padding,
    justifyContent: 'flex-start',
  },
});

export default PaginationListFooter;

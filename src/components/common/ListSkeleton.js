import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const CARD_COUNT = 4;
const SKELETON_BG = '#E1E5EB';
const SHIMMER_COLOR = 'rgba(255, 255, 255, 0.7)';
const SHIMMER_WIDTH = 80;
const CARD_APPROX_WIDTH = 400;

/**
 * Skeleton loader with avatar circle, content lines, and left-to-right shimmer animation.
 * Matches the card-style placeholder with sweeping shine effect.
 */
const ListSkeleton = ({ count = CARD_COUNT, style }) => {
  const shimmerTranslate = useRef(new Animated.Value(-SHIMMER_WIDTH)).current;

  useEffect(() => {
    shimmerTranslate.setValue(-SHIMMER_WIDTH);
    const animation = Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: CARD_APPROX_WIDTH,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerTranslate]);

  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.cardInner} pointerEvents="none">
            {/* Avatar circle + title row */}
            <View style={styles.topRow}>
              <View style={styles.avatarCircle} />
              <View style={styles.titleLine} />
            </View>
            {/* Main content line (wide) */}
            <View style={[styles.skeletonLine, styles.mainLine]} />
            {/* Secondary line (medium) */}
            <View style={[styles.skeletonLine, styles.secondaryLine]} />
            {/* Small lines */}
            <View style={[styles.skeletonLine, styles.smallLine1]} />
            <View style={[styles.skeletonLine, styles.smallLine2]} />
          </View>
          {/* Shimmer overlay - sweeps left to right */}
          <View style={styles.shimmerWrap} overflow="hidden">
            <Animated.View
              style={[
                styles.shimmerBar,
                {
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SIZES.padding,
    paddingTop: SIZES.padding * 0.75,
  },
  skeletonCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin * 0.5,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardInner: {
    position: 'relative',
    zIndex: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SKELETON_BG,
    marginRight: SIZES.base,
  },
  titleLine: {
    flex: 1,
    height: 14,
    backgroundColor: SKELETON_BG,
    borderRadius: 4,
    maxWidth: '50%',
  },
  skeletonLine: {
    height: 12,
    backgroundColor: SKELETON_BG,
    borderRadius: 4,
  },
  mainLine: {
    width: '100%',
    marginBottom: SIZES.base,
  },
  secondaryLine: {
    width: '85%',
    marginBottom: SIZES.base * 0.75,
  },
  smallLine1: {
    width: '45%',
    marginBottom: SIZES.base * 0.5,
  },
  smallLine2: {
    width: '35%',
  },
  shimmerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  shimmerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SHIMMER_WIDTH,
    height: '100%',
    backgroundColor: SHIMMER_COLOR,
    borderRadius: 2,
  },
});

export default ListSkeleton;

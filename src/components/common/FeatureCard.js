import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';

const FeatureCard = ({
  icon,
  title,
  subtitle,
  onPress,
  color = COLORS.primary,
  size = 'medium',
}) => {
  const cardSizes = {
    small: {
      container: { width: '48%' },
      icon: { fontSize: SIZES.h3 },
      title: { fontSize: SIZES.body3 },
      subtitle: { fontSize: SIZES.body4 },
    },
    medium: {
      container: { width: '100%' },
      icon: { fontSize: SIZES.h2 },
      title: { fontSize: SIZES.body2 },
      subtitle: { fontSize: SIZES.body3 },
    },
    large: {
      container: { width: '100%' },
      icon: { fontSize: SIZES.h1 },
      title: { fontSize: SIZES.h3 },
      subtitle: { fontSize: SIZES.body2 },
    },
  };

  const currentSize = cardSizes[size];

  return (
    <TouchableOpacity
      style={[styles.container, currentSize.container]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
          <Text style={[styles.icon, { color }, currentSize.icon]}>
            {icon}
          </Text>
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, currentSize.title]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, currentSize.subtitle]}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.arrow}>
          <Text style={[styles.arrowIcon, { color }]}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SIZES.margin,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding * 1.5,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    borderLeftWidth: 4,
    ...SHADOWS.medium,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.margin,
  },
  icon: {
    fontSize: SIZES.h2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  subtitle: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
  },
  arrow: {
    marginLeft: SIZES.margin,
  },
  arrowIcon: {
    fontSize: SIZES.h2,
    color: COLORS.text.tertiary,
  },
});

export default FeatureCard;

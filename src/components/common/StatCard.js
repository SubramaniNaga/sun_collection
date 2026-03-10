import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';

const StatCard = ({
  title,
  value,
  change,
  changeType = 'positive',
  icon,
  size = 'medium',
}) => {
  const cardSizes = {
    small: {
      container: { width: '48%' },
      value: { fontSize: SIZES.h2 },
      title: { fontSize: SIZES.body4 },
      change: { fontSize: SIZES.body4 },
    },
    medium: {
      container: { width: '48%' },
      value: { fontSize: SIZES.h1 },
      title: { fontSize: SIZES.body3 },
      change: { fontSize: SIZES.body4 },
    },
    large: {
      container: { width: '100%' },
      value: { fontSize: SIZES.h1 },
      title: { fontSize: SIZES.body2 },
      change: { fontSize: SIZES.body3 },
    },
  };

  const currentSize = cardSizes[size];

  const changeColor = changeType === 'positive' ? COLORS.success : 
                     changeType === 'negative' ? COLORS.error : 
                     COLORS.warning;

  return (
    <View style={[styles.container, currentSize.container]}>
      <View style={styles.card}>
        {icon && (
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
        )}
        <Text style={[styles.value, currentSize.value]}>{value}</Text>
        <Text style={[styles.title, currentSize.title]}>{title}</Text>
        {change && (
          <View style={styles.changeContainer}>
            <Text style={[styles.change, { color: changeColor }, currentSize.change]}>
              {change}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SIZES.margin,
  },
  card: {
    padding: SIZES.padding * 1.5,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.margin,
  },
  icon: {
    fontSize: SIZES.body2,
    color: COLORS.primary,
  },
  value: {
    fontSize: SIZES.h1,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SIZES.base / 2,
  },
  title: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SIZES.base / 2,
  },
  changeContainer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
  },
  change: {
    fontSize: SIZES.body4,
    fontWeight: '600',
  },
});

export default StatCard;

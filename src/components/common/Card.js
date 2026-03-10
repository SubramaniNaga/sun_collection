import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const Card = ({
  children,
  style,
  onPress,
  disabled = false,
  elevation = 2,
  borderRadius = SIZES.radius,
  backgroundColor = COLORS.white,
  padding = SIZES.padding,
  margin = 0,
  ...props
}) => {
  const cardStyle = [
    styles.card,
    {
      backgroundColor,
      borderRadius,
      padding,
      margin,
      elevation,
      shadowOpacity: elevation * 0.1,
      shadowOffset: {
        width: 0,
        height: elevation * 0.5,
      },
      shadowRadius: elevation,
    },
    style,
  ];

  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <CardComponent
      style={cardStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      {...props}
    >
      {children}
    </CardComponent>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default Card;

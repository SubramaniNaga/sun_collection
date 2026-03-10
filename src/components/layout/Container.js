import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';

const Container = ({
  children,
  style,
  safeArea = true,
  backgroundColor = COLORS.background,
  padding = SIZES.padding,
  ...props
}) => {
  const insets = useSafeAreaInsets();

  const containerStyle = [
    styles.container,
    {
      backgroundColor,
      paddingTop: safeArea ? insets.top : padding,
      paddingBottom: safeArea ? insets.bottom : padding,
      paddingLeft: safeArea ? insets.left + padding : padding,
      paddingRight: safeArea ? insets.right + padding : padding,
    },
    style,
  ];

  return (
    <View style={containerStyle} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default Container;

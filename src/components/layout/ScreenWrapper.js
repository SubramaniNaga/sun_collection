import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';

const ScreenWrapper = ({
  children,
  style,
  scrollable = false,
  backgroundColor = COLORS.background,
  padding = SIZES.padding,
  safeArea = true,
  keyboardShouldPersistTaps = 'handled',
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

  const contentStyle = [
    styles.content,
    {
      paddingLeft: safeArea ? 0 : padding,
      paddingRight: safeArea ? 0 : padding,
    },
  ];

  if (scrollable) {
    return (
      <View style={containerStyle}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          {...props}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={contentStyle}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default ScreenWrapper;

export const COLORS = {
  primary: '#1d7ee2',
  secondary: '#1d7ee2',
  
  white: '#FFFFFF',
  black: '#000000',
  gray: '#666666',
  lightGray: '#F5F5F5',
  border: '#E0E0E0',
  background: '#FFFFFF',
  overlay: 'rgba(5, 54, 163, 0.8)',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  
  text: {
    primary: '#1d7ee2',
    secondary: '#333333',
    tertiary: '#666666',
    white: '#FFFFFF',
  },
};

export const SIZES = {
  base: 8,
  padding: 16,
  margin: 16,
  radius: 8,
  border: 1,
  
  font: {
    tiny: 10,
    small: 12,
    medium: 14,
    large: 16,
    xlarge: 18,
    xxlarge: 20,
    xxxlarge: 24,
  },
  
  body5: 10,
  body4: 12,
  body3: 14,
  body2: 16,
  body1: 18,
  h3: 20,
  h2: 24,
  h1: 32,
  
  width: {
    full: '100%',
    half: '50%',
    third: '33.33%',
    quarter: '25%',
  },
  
  height: {
    full: '100%',
    half: '50%',
    third: '33.33%',
    quarter: '25%',
  },
};

export const FONTS = {
  primary: 'System',
  secondary: 'System',
  
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const FONT_SIZES = {
  tiny: SIZES.font.tiny,
  small: SIZES.font.small,
  medium: SIZES.font.medium,
  large: SIZES.font.large,
  xlarge: SIZES.font.xlarge,
  xxlarge: SIZES.font.xxlarge,
  xxxlarge: SIZES.font.xxxlarge,
};

export const SPACING = {
  xs: SIZES.base / 2,
  sm: SIZES.base,
  md: SIZES.base * 2,
  lg: SIZES.base * 3,
  xl: SIZES.base * 4,
  xxl: SIZES.base * 5,
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  large: {
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
};

export const BORDER_RADIUS = {
  small: SIZES.radius / 2,
  medium: SIZES.radius,
  large: SIZES.radius * 2,
  xl: SIZES.radius * 3,
  full: 9999,
};

export const BREAKPOINTS = {
  small: 320,
  medium: 768,
  large: 1024,
  xlarge: 1440,
};

export default {
  COLORS,
  SIZES,
  FONTS,
  FONT_SIZES,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  BREAKPOINTS,
};

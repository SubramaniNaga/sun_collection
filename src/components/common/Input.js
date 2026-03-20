import { StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  error,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  style,
  inputStyle,
  labelStyle,
  errorStyle,
  leftIcon,
  rightIcon,
  containerStyle,
  ...props
}) => {
  const getInputStyle = () => {
    const baseStyle = [styles.input];
    
    if (error) {
      baseStyle.push(styles.errorInput);
    }
    
    if (disabled) {
      baseStyle.push(styles.disabledInput);
    }
    
    if (multiline) {
      baseStyle.push(styles.multilineInput);
    }
    
    if (leftIcon) {
      baseStyle.push(styles.inputWithLeftIcon);
    }
    
    if (rightIcon) {
      baseStyle.push(styles.inputWithRightIcon);
    }

    return baseStyle;
  };

  return (
    <View style={[styles.container, style, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      )}
      
      <View style={styles.inputContainer}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          style={[getInputStyle(), inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.gray}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          {...props}
        />
        
        {rightIcon && (
          <View style={styles.rightIconContainer}>
            {rightIcon}
          </View>
        )}
      </View>
      
      {error && (
        <Text style={[styles.errorText, errorStyle]}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SIZES.margin,
  },
  label: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SIZES.base / 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    fontSize: SIZES.body3,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  errorInput: {
    borderColor: COLORS.error,
  },
  disabledInput: {
    backgroundColor: COLORS.lightGray,
    color: COLORS.gray,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputWithLeftIcon: {
    paddingLeft: SIZES.padding * 3.5,
  },
  inputWithRightIcon: {
    paddingRight: SIZES.padding * 3.5,
  },
  leftIconContainer: {
    position: 'absolute',
    left: SIZES.padding,
    zIndex: 1,
  },
  rightIconContainer: {
    position: 'absolute',
    right: SIZES.padding,
    zIndex: 1,
  },
  errorText: {
    fontSize: SIZES.body5,
    color: COLORS.error,
    marginTop: SIZES.base / 2,
  },
});

export default Input;

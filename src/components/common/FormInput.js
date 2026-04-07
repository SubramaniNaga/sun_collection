import { Text, TextInput, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const FormInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  maxLength,
  error,
  editable = true,
  required = false,
  style = {},
  ...props
}) => {
  return (
    <View style={[{ marginBottom: SIZES.margin }, style]}>
      {label && (
        <Text style={{
          fontSize: SIZES.body2,
          fontWeight: '500',
          color: COLORS.text.primary,
          marginBottom: SIZES.base,
        }}>
          {label}
          {required ? (
            <Text style={{ color: COLORS.error, fontWeight: '600' }}> *</Text>
          ) : null}
        </Text>
      )}
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: error ? 'red' : COLORS.border,
          borderRadius: SIZES.radius,
          paddingHorizontal: SIZES.padding,
          paddingVertical: multiline ? SIZES.padding : SIZES.padding * 0.8,
          fontSize: SIZES.body2,
          color: COLORS.black,
          backgroundColor: editable ? COLORS.white : COLORS.lightGray,
          textAlignVertical: multiline ? 'top' : 'center',
          minHeight: multiline ? 80 : 0,
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.text.tertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        editable={editable}
        {...props}
      />
      {error && (
        <Text style={{
          fontSize: SIZES.body3,
          color: 'red',
          marginTop: SIZES.base / 2,
        }}>
          {error}
        </Text>
      )}
    </View>
  );
};

export default FormInput;

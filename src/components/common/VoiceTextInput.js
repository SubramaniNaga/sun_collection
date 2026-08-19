import { forwardRef } from 'react';
import { Text, TextInput, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import VoiceMicButton from './VoiceMicButton';

const VoiceTextInput = forwardRef(({
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
}, ref) => {
  return (
    <View style={[{ marginBottom: SIZES.margin }, style]}>
      {label ? (
        <Text
          style={{
            fontSize: SIZES.body2,
            fontWeight: '500',
            color: COLORS.text.primary,
            marginBottom: SIZES.base,
          }}
        >
          {label}
          {required ? (
            <Text style={{ color: COLORS.error, fontWeight: '600' }}> *</Text>
          ) : null}
        </Text>
      ) : null}
      <View
        style={{
          borderWidth: 1,
          borderColor: error ? 'red' : COLORS.border,
          borderRadius: SIZES.radius,
          backgroundColor: editable ? COLORS.white : COLORS.lightGray,
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
        }}
      >
        <TextInput
          ref={ref}
          style={{
            flex: 1,
            paddingHorizontal: SIZES.padding,
            paddingVertical: multiline ? SIZES.padding : SIZES.padding * 0.8,
            paddingRight: 8,
            fontSize: SIZES.body2,
            color: COLORS.black,
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
        {editable ? (
          <VoiceMicButton
            value={value}
            onChangeText={onChangeText}
            disabled={!editable}
          />
        ) : null}
      </View>
      {error ? (
        <Text
          style={{
            fontSize: SIZES.body3,
            color: 'red',
            marginTop: SIZES.base / 2,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

VoiceTextInput.displayName = 'VoiceTextInput';

export default VoiceTextInput;

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { formatDisplayDate, getCalendarDate } from '../../utils/dateFormatter';

const DatePicker = ({
  label,
  value,
  onValueChange,
  error,
  editable = true,
  required = false,
  style = {},
  minimumDate,
  maximumDate,
  visible: visibleProp,
  onVisibleChange,
}) => {
  const isControlled = visibleProp !== undefined;
  const [internalShow, setInternalShow] = useState(false);
  const show = isControlled ? visibleProp : internalShow;

  const setShow = (next) => {
    if (!isControlled) setInternalShow(next);
    onVisibleChange?.(next);
  };

  // Convert the ISO string from your formData back to a Date object for the picker
  const dateValue = value ? new Date(value) : getCalendarDate();

  const onChange = (event, selectedDate) => {
    // For Android, we must close the picker immediately
    if (Platform.OS === 'android') {
      setShow(false);
    }

    if (event.type === 'set' && selectedDate) {
      // Send the ISO string back to your handleInputChange function
      onValueChange(selectedDate.toISOString());
    } else {
      // User dismissed the picker
      setShow(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required ? (
            <Text style={styles.labelRequired}> *</Text>
          ) : null}
        </Text>
      )}

      <Pressable
        onPress={() => editable && setShow(true)}
        style={[
          styles.inputContainer,
          {
            borderColor: error ? 'red' : COLORS.border,
            backgroundColor: editable ? COLORS.white : COLORS.lightGray,
          },
        ]}
      >
        
        
        <Text style={[
          styles.valueText,
          { color: value ? COLORS.black : COLORS.text?.tertiary }
        ]}>
          {formatDisplayDate(value) || 'Select date'}
        </Text>

        {editable && (
          <Ionicons 
          name="calendar-outline" 
          size={20} 
          color={COLORS.text?.tertiary || '#7C7C7C'} 
          style={{ marginRight: SIZES.base }}
        />
        )}
      </Pressable>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* On iOS, the picker can be displayed as a 'spinner', 'calendar', or 'compact'. 
          'default' usually shows a calendar modal.
      */}
      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate || new Date()} // Default to today if no maximumDate provided
          onChange={onChange}
        />
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
    fontWeight: '500',
    color: COLORS.text?.primary || '#333',
    marginBottom: SIZES.base,
  },
  labelRequired: {
    color: COLORS.error,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.8,
    minHeight: 50,
  },
  valueText: {
    flex: 1,
    fontSize: SIZES.body3,
  },
  errorText: {
    fontSize: SIZES.body3,
    color: 'red',
    marginTop: SIZES.base / 2,
  },
});

export default DatePicker;
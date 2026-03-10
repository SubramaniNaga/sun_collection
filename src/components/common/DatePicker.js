import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const DatePicker = ({
  label,
  value,
  onValueChange,
  error,
  editable = true,
  style = {},
  minimumDate,
  maximumDate,
}) => {
  
  const [show, setShow] = useState(false);

  // Convert the ISO string from your formData back to a Date object for the picker
  const dateValue = value ? new Date(value) : new Date();

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    // Formatting to DD/MM/YYYY
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

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
      {label && <Text style={styles.label}>{label}</Text>}

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
        <Ionicons 
          name="calendar-outline" 
          size={20} 
          color={COLORS.text?.tertiary || '#7C7C7C'} 
          style={{ marginRight: SIZES.base }}
        />
        
        <Text style={[
          styles.valueText,
          { color: value ? COLORS.text?.primary : COLORS.text?.tertiary }
        ]}>
          {formatDate(value) || 'Select date'}
        </Text>

        {editable && (
          <Ionicons 
            name="chevron-down" 
            size={18} 
            color={COLORS.text?.tertiary || '#7C7C7C'} 
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
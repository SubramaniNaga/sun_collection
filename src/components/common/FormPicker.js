import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';

const FormPicker = ({
  label,
  value,
  onValueChange,
  items,
  placeholder,
  error,
  editable = true,
  required = false,
  style = {},
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedItem = items.find(item => item.value === value);

  return (
    <View style={[{ marginBottom: SIZES.margin }, style]}>
      {label && (
        <Text style={{
          fontSize: SIZES.body2,
          fontWeight: '600',
          color: COLORS.primary,
          marginBottom: SIZES.base,
        }}>
          {label}
          {required ? (
            <Text style={{ color: COLORS.error, fontWeight: '600' }}> *</Text>
          ) : null}
        </Text>
      )}
      
      <Pressable
        onPress={() => editable && setModalVisible(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? 'red' : COLORS.border,
          borderRadius: SIZES.radius,
          paddingHorizontal: SIZES.padding,
          paddingVertical: SIZES.padding * 0.8,
          backgroundColor: editable ? COLORS.white : COLORS.lightGray,
        }}
      >
        <Text style={{
          flex: 1,
          fontSize: SIZES.body2,
          color: selectedItem ? COLORS.black : COLORS.text.tertiary,
        }}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        {editable && (
          <Ionicons 
            name="chevron-down" 
            size={20} 
            color={COLORS.text.tertiary} 
          />
        )}
      </Pressable>

      {error && (
        <Text style={{
          fontSize: SIZES.body3,
          color: 'red',
          marginTop: SIZES.base / 2,
        }}>
          {error}
        </Text>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent={true}
      >
        <SafeAreaView style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}>
          <View style={{
            flex: 1,
            justifyContent: 'flex-end',
          }}>
            <View style={{
              backgroundColor: COLORS.white,
              borderTopLeftRadius: SIZES.radius * 2,
              borderTopRightRadius: SIZES.radius * 2,
              maxHeight: '50%',
            }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: SIZES.padding,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
            }}>
              <Text style={{
                fontSize: SIZES.h3,
                fontWeight: '600',
                color: COLORS.black,
              }}>
                Select {label}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.secondary} />
              </Pressable>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                  style={{
                    padding: SIZES.padding,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border,
                    backgroundColor: value === item.value ? COLORS.lightGray : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: SIZES.body2,
                    color: COLORS.black,
                    fontWeight: value === item.value ? '600' : '400',
                  }}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default FormPicker;

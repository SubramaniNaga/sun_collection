import { Ionicons } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const CustomImagePicker = ({
  image,
  onImageChange,
  error,
  editable = true,
  style = {},
}) => {
  const pickImage = async (source) => {
    if (!editable) return;

    let result;
    try {
      if (source === 'camera') {
        // Request camera permission
        const cameraPermission = await ExpoImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          Alert.alert('Permission Required', 'Camera permission is required to take photos.');
          return;
        }

        result = await ExpoImagePicker.launchCameraAsync({
          mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        // Request media library permission
        const mediaPermission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
        if (!mediaPermission.granted) {
          Alert.alert('Permission Required', 'Gallery permission is required to select photos.');
          return;
        }

        result = await ExpoImagePicker.launchImageLibraryAsync({
          mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onImageChange(result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removeImage = () => {
    if (editable) {
      Alert.alert(
        'Remove Image',
        'Are you sure you want to remove this image?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', onPress: () => onImageChange(null) },
        ]
      );
    }
  };

  return (
    <View style={[{ marginBottom: SIZES.margin }, style]}>
      <Text style={{
        fontSize: SIZES.body2,
        fontWeight: '500',
        color: COLORS.text.primary,
        marginBottom: SIZES.base,
      }}>
        Receipt Image
      </Text>

      {image ? (
        <View style={{
          borderWidth: 1,
          borderColor: error ? 'red' : COLORS.border,
          borderRadius: SIZES.radius,
          overflow: 'hidden',
        }}>
          <Image
            source={{ uri: image.uri }}
            style={{
              width: '100%',
              height: 200,
              backgroundColor: COLORS.lightGray,
            }}
            resizeMode="cover"
          />
          {editable && (
            <View style={{
              flexDirection: 'row',
              padding: SIZES.base,
              backgroundColor: COLORS.white,
            }}>
              <Pressable
                onPress={() => pickImage('camera')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: SIZES.base,
                  backgroundColor: COLORS.primary,
                  borderRadius: SIZES.radius,
                  marginRight: SIZES.base,
                }}
              >
                <Ionicons name="camera" size={16} color={COLORS.white} />
                <Text style={{
                  color: COLORS.white,
                  fontSize: SIZES.body3,
                  fontWeight: '500',
                  marginLeft: SIZES.base / 2,
                }}>
                  Retake
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => pickImage('gallery')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: SIZES.base,
                  backgroundColor: COLORS.secondary,
                  borderRadius: SIZES.radius,
                  marginRight: SIZES.base,
                }}
              >
                <Ionicons name="image" size={16} color={COLORS.white} />
                <Text style={{
                  color: COLORS.white,
                  fontSize: SIZES.body3,
                  fontWeight: '500',
                  marginLeft: SIZES.base / 2,
                }}>
                  Gallery
                </Text>
              </Pressable>

              <Pressable
                onPress={removeImage}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: SIZES.base,
                  paddingHorizontal: SIZES.base,
                  backgroundColor: '#FF5252',
                  borderRadius: SIZES.radius,
                }}
              >
                <Ionicons name="trash" size={16} color={COLORS.white} />
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={{
          borderWidth: 1,
          borderColor: error ? 'red' : COLORS.border,
          borderRadius: SIZES.radius,
          borderStyle: 'dashed',
          padding: SIZES.padding * 2,
          alignItems: 'center',
          backgroundColor: COLORS.lightGray,
        }}>
          <Ionicons name="image-outline" size={48} color={COLORS.text.tertiary} />
          <Text style={{
            fontSize: SIZES.body2,
            color: COLORS.text.secondary,
            marginTop: SIZES.base,
            marginBottom: SIZES.margin,
          }}>
            Add receipt image
          </Text>
          
          <View style={{
            flexDirection: 'row',
            gap: SIZES.base,
          }}>
            <Pressable
              onPress={() => pickImage('camera')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: SIZES.base,
                paddingHorizontal: SIZES.padding,
                backgroundColor: COLORS.primary,
                borderRadius: SIZES.radius,
              }}
            >
              <Ionicons name="camera" size={16} color={COLORS.white} />
              <Text style={{
                color: COLORS.white,
                fontSize: SIZES.body3,
                fontWeight: '500',
                marginLeft: SIZES.base / 2,
              }}>
                Camera
              </Text>
            </Pressable>
            
            <Pressable
              onPress={() => pickImage('gallery')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: SIZES.base,
                paddingHorizontal: SIZES.padding,
                backgroundColor: COLORS.secondary,
                borderRadius: SIZES.radius,
              }}
            >
              <Ionicons name="image" size={16} color={COLORS.white} />
              <Text style={{
                color: COLORS.white,
                fontSize: SIZES.body3,
                fontWeight: '500',
                marginLeft: SIZES.base / 2,
              }}>
                Gallery
              </Text>
            </Pressable>
          </View>
        </View>
      )}

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

export default CustomImagePicker;

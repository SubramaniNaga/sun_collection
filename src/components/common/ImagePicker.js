import { Ionicons } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { showAlert, showError, showWarning } from '../../utils/alertService';
import { pickFromCamera, pickFromLibrary } from '../../utils/imagePickerHelper';
import ImagePreviewModal from './ImagePreviewModal';

const CustomImagePicker = ({
  image,
  onImageChange,
  error,
  editable = true,
  label = 'Receipt Image',
  required = false,
  style = {},
}) => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const pickImage = async (source) => {
    if (!editable) return;

    try {
      if (source === 'camera') {
        const cameraPermission = await ExpoImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          showWarning('Permission Required', 'Camera permission is required to take photos.');
          return;
        }
        const asset = await pickFromCamera();
        if (asset) onImageChange(asset);
      } else {
        const mediaPermission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
        if (!mediaPermission.granted) {
          showWarning('Permission Required', 'Gallery permission is required to select photos.');
          return;
        }
        const asset = await pickFromLibrary();
        if (asset) onImageChange(asset);
      }
    } catch (error) {
      console.error('Image picker error:', error?.message ?? error);
      showError('Error', error?.message || 'Failed to pick image. Please try again.');
    }
  };

  const removeImage = () => {
    if (editable) {
      showAlert({
        type: 'warning',
        title: 'Remove Image',
        message: 'Are you sure you want to remove this image?',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', onPress: () => onImageChange(null) },
        ],
      });
    }
  };

  return (
    <View style={[{ marginBottom: SIZES.margin }, style]}>
      <Text style={{
        fontSize: SIZES.body2,
        fontWeight: '500',
        color: COLORS.black,
        marginBottom: SIZES.base,
      }}>
        {label}
        {required ? (
          <Text style={{ color: COLORS.error, fontWeight: '600' }}> *</Text>
        ) : null}
      </Text>

      {image ? (
        <View style={{
          borderWidth: 1,
          borderColor: error ? 'red' : COLORS.border,
          borderRadius: SIZES.radius,
          overflow: 'hidden',
        }}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => setPreviewVisible(true)}>
            <Image
              source={{ uri: image.uri }}
              style={{
                width: '100%',
                height: 200,
                backgroundColor: COLORS.lightGray,
              }}
              resizeMode="cover"
            />
            {/* Tap-to-preview hint */}
            <View style={{
              position: 'absolute',
              bottom: 6,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.45)',
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Ionicons name="expand-outline" size={12} color={COLORS.white} />
              <Text style={{ color: COLORS.white, fontSize: 11, marginLeft: 3 }}>Preview</Text>
            </View>
          </TouchableOpacity>
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

      <ImagePreviewModal
        visible={previewVisible}
        uri={image?.uri ?? null}
        title="Receipt Image"
        onClose={() => setPreviewVisible(false)}
      />
    </View>
  );
};

export default CustomImagePicker;

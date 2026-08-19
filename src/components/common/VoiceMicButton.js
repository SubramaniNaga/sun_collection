import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import {
  appendTranscription,
  SpeechToTextError,
  uploadAudioForTranscription,
} from '../../api/services/speechToText';
import { COLORS } from '../../constants/theme';
import { showError } from '../../utils/alertService';

async function safeUnload(recording) {
  if (!recording) return;
  try {
    const status = await recording.getStatusAsync();
    if (status?.isRecording || status?.canRecord) {
      await recording.stopAndUnloadAsync();
    }
  } catch {
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // already unloaded
    }
  }
}

async function resetAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // ignore
  }
}

/**
 * Shared mic control. Drop next to any TextInput; API parsing stays in speechToText.js.
 */
export default function VoiceMicButton({
  value,
  onChangeText,
  disabled = false,
  size = 22,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef(null);
  const mountedRef = useRef(true);
  const lockRef = useRef(false);
  const valueRef = useRef(value);

  valueRef.current = value;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const rec = recordingRef.current;
      recordingRef.current = null;
      lockRef.current = false;
      if (rec) {
        safeUnload(rec).then(resetAudioMode).catch(() => {});
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission?.granted) {
        showError(
          'Microphone',
          'Microphone permission is required to use voice input.',
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      if (mountedRef.current) setIsRecording(true);
    } catch (err) {
      recordingRef.current = null;
      await resetAudioMode();
      if (__DEV__) {
        console.warn('VoiceMicButton start failed:', err?.message || err);
      }
      showError('Recording', 'Unable to start recording. Please try again.');
    }
  };

  const stopAndTranscribe = async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (mountedRef.current) {
      setIsRecording(false);
      setIsTranscribing(true);
    }

    try {
      if (!recording) {
        throw new SpeechToTextError(
          'No audio recording was created. Please try again.',
          'missing_uri',
        );
      }
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      await resetAudioMode();

      if (!uri) {
        throw new SpeechToTextError(
          'No audio recording was created. Please try again.',
          'missing_uri',
        );
      }

      const text = await uploadAudioForTranscription(uri);
      if (!mountedRef.current) return;
      onChangeText?.(appendTranscription(valueRef.current, text));
    } catch (err) {
      await resetAudioMode();
      if (__DEV__) {
        console.warn('VoiceMicButton stop/upload failed:', err?.message || err);
      }
      const message =
        err instanceof SpeechToTextError
          ? err.message
          : 'Unable to convert your voice to text. Please try again.';
      showError('Voice input', message);
    } finally {
      lockRef.current = false;
      if (mountedRef.current) setIsTranscribing(false);
    }
  };

  const handleMicPress = async () => {
    if (disabled || isTranscribing) return;
    if (lockRef.current && !isRecording) return;

    if (isRecording) {
      lockRef.current = true;
      await stopAndTranscribe();
      return;
    }

    lockRef.current = true;
    try {
      await startRecording();
    } finally {
      if (!recordingRef.current) {
        lockRef.current = false;
      }
    }
  };

  const micDisabled = disabled || isTranscribing;
  const micColor = isRecording ? COLORS.error : COLORS.primary;

  return (
    <Pressable
      onPress={handleMicPress}
      disabled={micDisabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isRecording ? 'Stop recording' : 'Start voice input'}
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: micDisabled ? 0.5 : 1,
      }}
    >
      {isTranscribing ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <Ionicons
          name={isRecording ? 'stop-circle' : 'mic-outline'}
          size={size}
          color={micColor}
        />
      )}
    </Pressable>
  );
}

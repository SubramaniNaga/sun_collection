import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../apiClient';
import { getDeviceId } from '../../utils/deviceId';

const AUDIO_TO_TEXT_PATH = '/audio/to-text';
const REQUEST_TIMEOUT_MS = 60000;

export class SpeechToTextError extends Error {
  constructor(message, code = 'unknown') {
    super(message);
    this.name = 'SpeechToTextError';
    this.code = code;
  }
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

export function parseTranscription(responseData) {
  if (responseData == null) return '';
  if (typeof responseData === 'string') return responseData.trim();
  if (typeof responseData !== 'object') return '';

  const nested = responseData.data && typeof responseData.data === 'object'
    ? responseData.data
    : null;

  return pickString(
    nested?.translated_text,
    responseData.translated_text,
    responseData.text,
    responseData.english_text,
    responseData.original_text,
    responseData.transcript,
    responseData.transcription,
    responseData.result,
    nested?.english_text,
    nested?.original_text,
    nested?.text,
    nested?.transcript,
    nested?.transcription,
    nested?.result,
  );
}

function audioPartFromUri(uri) {
  const raw = String(uri);
  const fileName = raw.split('/').pop()?.split('?')[0] || 'recording.m4a';
  const lower = fileName.toLowerCase();
  let type = 'audio/mp4';
  if (lower.endsWith('.3gp')) type = 'audio/3gpp';
  else if (lower.endsWith('.aac')) type = 'audio/aac';
  else if (lower.endsWith('.wav')) type = 'audio/wav';
  else if (lower.endsWith('.mp3')) type = 'audio/mpeg';
  else if (lower.endsWith('.m4a')) type = 'audio/mp4';
  return { uri: raw, name: fileName, type };
}

async function resolveDeviceHeader() {
  const stored =
    (await AsyncStorage.getItem('deviceId')) ||
    (await AsyncStorage.getItem('userDevice'));
  if (stored && String(stored).trim()) {
    return String(stored).trim();
  }
  return getDeviceId();
}

/**
 * POST /audio/to-text as multipart/form-data (field: audio).
 * Auth + device headers come from the same storage as the rest of the app.
 */
export async function uploadAudioForTranscription(audioUri) {
  if (!audioUri) {
    throw new SpeechToTextError(
      'No audio recording was created. Please try again.',
      'missing_uri',
    );
  }

  const token = await AsyncStorage.getItem('authToken');
  const device = await resolveDeviceHeader();
  const formData = new FormData();
  formData.append('audio', audioPartFromUri(audioUri));

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    device,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${AUDIO_TO_TEXT_PATH}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));

    if (__DEV__) {
      console.log('Speech-to-text response:', data);
    }

    if (!response.ok || data?.success === false) {
      const apiMessage = pickString(data?.message, data?.error);
      throw new SpeechToTextError(
        apiMessage || 'Unable to convert your voice to text. Please try again.',
        'api',
      );
    }

    const text = parseTranscription(data);
    if (!text) {
      throw new SpeechToTextError('No speech was detected.', 'empty');
    }
    return text;
  } catch (error) {
    if (error instanceof SpeechToTextError) {
      throw error;
    }
    if (error?.name === 'AbortError') {
      throw new SpeechToTextError(
        'Unable to convert your voice to text. Please try again.',
        'timeout',
      );
    }
    throw new SpeechToTextError(
      'Unable to convert your voice to text. Please try again.',
      'network',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function appendTranscription(existing, incoming) {
  const next = String(incoming || '').trim();
  if (!next) return existing ?? '';
  const prev = String(existing || '');
  if (!prev.trim()) return next;
  if (/\s$/.test(prev) || /^\s/.test(next)) {
    return `${prev}${next}`;
  }
  return `${prev} ${next}`;
}

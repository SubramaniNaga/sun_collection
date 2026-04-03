import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';

/**
 * PUT /user/:id with language (same as Profile language modal).
 * Updates @app_language and login_language in AsyncStorage.
 * @param {string} newLanguage - 'en' | 'ta'
 * @param {string|number} [userIdOverride] - from auth context when available
 */
export async function syncUserLanguageWithApi(newLanguage, userIdOverride) {
  const token = await AsyncStorage.getItem('authToken');
  const storedUserId = await AsyncStorage.getItem('userId');
  const userId = userIdOverride != null && userIdOverride !== '' ? userIdOverride : storedUserId;

  if (!token || !userId) {
    const err = new Error('NO_AUTH');
    err.code = 'NO_AUTH';
    throw err;
  }

  const formData = new FormData();
  formData.append('language', newLanguage);

  await apiClient.put(`/user/${userId}`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });

  await AsyncStorage.setItem('@app_language', newLanguage);
  await AsyncStorage.setItem('login_language', newLanguage);
}

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Centralized Session Manager
 * Handles all session-related storage operations
 */

// All storage keys that should be cleared on logout
const SESSION_KEYS = [
  'authToken',
  'refreshToken',
  'userData',
  'userId',
  'userName',
  'userPhone',
  'userRole',
  'userRoleId',
  'lineId',
  'branchId',
  'line_id', // Alternative key format
  'branch_id', // Alternative key format
  'userDevice',
];

/**
 * Clear all session data from AsyncStorage
 * @returns {Promise<void>}
 */
export const clearSession = async () => {
  try {
    console.log('🔐 Clearing session data...');
    await AsyncStorage.multiRemove(SESSION_KEYS);
    console.log('✅ Session data cleared successfully');
  } catch (error) {
    if (__DEV__) console.warn('❌ Error clearing session data:', error);
    // Try to clear individually if multiRemove fails
    try {
      await Promise.all(
        SESSION_KEYS.map(key => AsyncStorage.removeItem(key).catch(() => {}))
      );
      console.log('✅ Session data cleared (fallback method)');
    } catch (fallbackError) {
      if (__DEV__) console.warn('❌ Error in fallback session clear:', fallbackError);
      throw fallbackError;
    }
  }
};

/**
 * Get all session keys
 * @returns {string[]}
 */
export const getSessionKeys = () => {
  return [...SESSION_KEYS];
};

/**
 * Check if user has active session
 * @returns {Promise<boolean>}
 */
export const hasActiveSession = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const userData = await AsyncStorage.getItem('userData');
    return !!(token && userData);
  } catch (error) {
    if (__DEV__) console.warn('Error checking session:', error);
    return false;
  }
};

export default {
  clearSession,
  getSessionKeys,
  hasActiveSession,
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import ErrorHandler from '../utils/errorHandler';
import { clearSession } from '../utils/sessionManager';

/**
 * CORS:
 * - Native (Android/iOS): CORS does NOT apply. "Network Error" is usually connectivity,
 *   timeout, or Android cleartext HTTP — not CORS.
 * - Web (browser): CORS applies. Only the backend can fix it (see BACKEND_CORS below).
 *   Frontend cannot bypass CORS; it is enforced by the browser.
 */
export const BACKEND_CORS_CHECKLIST = `
Backend team: to allow this app to call the API from the browser (web build), please:

1. Allow the app origin in CORS, e.g.:
   Access-Control-Allow-Origin: http://localhost:8081
   (or your production web URL, or "*" for development only)

2. Allow methods used by the app:
   Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS

3. Allow headers we send:
   Access-Control-Allow-Headers: Authorization, Content-Type, Accept

4. For PUT (and other non-simple requests), the browser sends an OPTIONS preflight.
   Respond to OPTIONS /api/v1/loan/given/:id with 200 and the above headers.

5. If using multipart/form-data (e.g. PUT /loan/given/:id with file), ensure
   Content-Type is not restricted — allow the request's Content-Type (including
   multipart/form-data with boundary).
`;



// export const API_BASE_URL = __DEV__
//   ? 'https://r2j2j5xx-6005.inc1.devtunnels.ms/api/v1'
//   : 'https://r2j2j5xx-6005.inc1.devtunnels.ms/api/v1';

export const API_BASE_URL = __DEV__
  ? 'http://65.0.100.65:6005/api/v1'
  : 'http://65.0.100.65:6005/api/v1';

/** Host root for media paths (no /api/v1 suffix). */
export const API_HOST_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/api')) return `${API_HOST_URL}${imagePath}`;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}${cleanPath}`;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Global loading state management
let loadingContext = null;

export const setLoadingContext = (context) => {
  loadingContext = context;
};

// Logout callback registry - allows AuthContext to register its logout function
let logoutCallback = null;
let unauthorizedInProgress = false;

/**
 * Register a logout callback function that will be called on 401/403 errors
 * @param {Function} callback - Function to call when logout is needed
 */
export const setLogoutCallback = (callback) => {
  logoutCallback = callback;
};

/**
 * Handle unauthorized access (401/403) - clears session and triggers logout
 */
const handleUnauthorized = async (error) => {
  if (unauthorizedInProgress) {
    return;
  }
  unauthorizedInProgress = true;
  try {
    console.log('🚫 Unauthorized access detected. Logging out user...');

    const apiMessage = String(
      error?.response?.data?.message ||
      error?.message ||
      ''
    ).trim();
    const lowerMessage = apiMessage.toLowerCase();
    const logoutReason =
      lowerMessage.includes('device id mismatch') || lowerMessage.includes('device mismatch')
        ? 'device_mismatch'
        : 'session_expired';

    await AsyncStorage.multiSet([
      ['logoutReason', logoutReason],
      ['logoutReasonMessage', apiMessage],
    ]);

    const { teardownLocationTrackingOnLogout } = require('../utils/locationTracker');
    await teardownLocationTrackingOnLogout();

    // Clear all session data
    await clearSession();

    // Trigger logout callback if registered (from AuthContext)
    if (logoutCallback && typeof logoutCallback === 'function') {
      console.log('🔄 Triggering logout callback...');
      await logoutCallback();
    } else {
      console.warn('⚠️ No logout callback registered. Session cleared but logout not triggered.');
    }
  } catch (error) {
    if (__DEV__) console.warn('❌ Error during unauthorized handling:', error);
    try {
      const { teardownLocationTrackingOnLogout } = require('../utils/locationTracker');
      await teardownLocationTrackingOnLogout();
    } catch (teardownError) {
      if (__DEV__) console.warn('❌ Error tearing down location tracking:', teardownError);
    }
    await clearSession();
    if (logoutCallback && typeof logoutCallback === 'function') {
      await logoutCallback();
    }
  } finally {
    unauthorizedInProgress = false;
  }
};


apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Add auth token to all requests except auth endpoints
      const token = await AsyncStorage.getItem('authToken');
      const publicEndpoints = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];
      const isPublicEndpoint = publicEndpoints.some(endpoint => config.url.includes(endpoint));

      if (token && !isPublicEndpoint) {
        config.headers.Authorization = `Bearer ${token}`;
      } else if (!token && !isPublicEndpoint) {
        console.warn(`⚠️ No auth token available for ${config.method?.toUpperCase()} ${config.url}`);
      }

      // High-frequency endpoints: no verbose request logging (avoids console flood).
      const isQuietEndpoint =
        (config.url && config.url.includes('/attendance/location-tracking')) ||
        config.skipApiLog === true;
      if (!isQuietEndpoint) {
        const method = (config.method || 'get').toUpperCase();
        const fullUrl = config.baseURL + config.url + (config.params && Object.keys(config.params).length
          ? '?' + new URLSearchParams(config.params).toString()
          : '');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📤 API REQUEST [${method}]`, fullUrl);
        if (config.params && Object.keys(config.params).length > 0) {
          console.log('📤 Request params:', JSON.stringify(config.params, null, 2));
        }
        if (config.data != null) {
          if (typeof config.data === 'object' && config.data.constructor?.name === 'FormData') {
            const keys = [];
            config.data.forEach((_, key) => keys.push(key));
            console.log('📤 Request body: FormData (multipart), keys:', keys.join(', '));
            try {
              config.data.forEach((value, key) => {
                if (value != null && typeof value === 'object' && 'uri' in value && 'name' in value) {
                  console.log(`📤   ${key}: [FILE] name=${value.name}, type=${value.type || 'n/a'}, uri=${typeof value.uri === 'string' ? value.uri.substring(0, 70) + '...' : value.uri}`);
                } else {
                  console.log(`📤   ${key}:`, value);
                }
              });
            } catch (e) {
              console.log('📤   (FormData values not logged:', e?.message, ')');
            }
          } else {
            console.log('📤 Request body:', JSON.stringify(config.data, null, 2));
          }
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        config.skipApiLog = true;
      }
      // Skip global loader for list/pagination endpoints – screens show their own loaders:
      // initial load = spinner only, pagination = skeleton only (mutually exclusive).
      const listEndpoints = ['/loan', '/expense', '/collection', '/loan/nip', '/expense-category/active/list'];
      const isListRequest = (config.method || 'get').toLowerCase() === 'get' &&
        listEndpoints.some(ep => config.url && config.url.includes(ep));
      const isCollectionHistory = config.url && config.url.includes('/collection/history');
      if (isListRequest || isCollectionHistory) {
        config.skipGlobalLoader = true;
      }

      // Start global loading only when screen is not handling it
      if (loadingContext && !config.skipGlobalLoader) {
        loadingContext.startLoading();
      }
    } catch (error) {
      if (__DEV__) console.warn('Error in request interceptor:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    // Log every API response – status and data (to verify response is coming correctly)
    if (!response.config?.skipApiLog) {
      const method = (response.config?.method || 'get').toUpperCase();
      const url = response.config?.url || '';
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📥 API RESPONSE [${method}]`, url, '| Status:', response.status);
      console.log('📥 Response data:', JSON.stringify(response.data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Stop global loading only if we started it (skip for list/pagination)
    if (loadingContext && !response.config?.skipGlobalLoader) {
      loadingContext.stopLoading();
    }
    return response;
  },
  async (error) => {
    // Log API error response (keep errors visible even for quiet endpoints)
    const method = (error.config?.method || 'get').toUpperCase();
    const url = error.config?.url || '';
    if (!error.config?.skipApiLog || __DEV__) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📥 API ERROR [${method}]`, url, '| Status:', error.response?.status, '| Message:', error.message);
      if (error.response?.data) {
        console.log('📥 Error response data:', JSON.stringify(error.response.data, null, 2));
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    // Stop global loading only if we started it (skip for list/pagination)
    if (loadingContext && !error.config?.skipGlobalLoader) {
      loadingContext.stopLoading();
    }

    // Handle authentication errors globally (401 Unauthorized, 403 Forbidden)
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log(`🔐 Authentication error (${error.response?.status}) detected. Initiating logout...`);

      // Handle unauthorized access - clear session and trigger logout
      await handleUnauthorized(error);
    }

    // Apply centralized error handling
    const handledError = ErrorHandler.handleGlobalError(error, {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      statusCode: error.response?.status,
    });

    return Promise.reject(handledError);
  }
);

export default apiClient;

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { ErrorHandler } from '../utils/errorHandler';
import { clearSession } from '../utils/sessionManager';

const API_BASE_URL = __DEV__ 
  ? 'http://65.0.100.65:6005/api/v1' 
  : 'http://65.0.100.65:6005/api/v1';

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
const handleUnauthorized = async () => {
  try {
    console.log('🚫 Unauthorized access detected. Logging out user...');
    
    // Clear all session data
    await clearSession();
    
    // Trigger logout callback if registered (from AuthContext)
    if (logoutCallback && typeof logoutCallback === 'function') {
      console.log('🔄 Triggering logout callback...');
      logoutCallback();
    } else {
      console.warn('⚠️ No logout callback registered. Session cleared but logout not triggered.');
    }
  } catch (error) {
    console.error('❌ Error during unauthorized handling:', error);
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
        console.log(`🔑 Adding auth token to ${config.method?.toUpperCase()} ${config.url}`);
      } else if (!token && !isPublicEndpoint) {
        console.warn(`⚠️ No auth token available for ${config.method?.toUpperCase()} ${config.url}`);
      }

      // Start global loading
      if (loadingContext) {
        loadingContext.startLoading();
      }
    } catch (error) {
      console.error('Error in request interceptor:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    // Stop global loading
    if (loadingContext) {
      loadingContext.stopLoading();
    }
    return response;
  },
  async (error) => {
    // Stop global loading
    if (loadingContext) {
      loadingContext.stopLoading();
    }

    // Handle authentication errors globally (401 Unauthorized, 403 Forbidden)
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log(`🔐 Authentication error (${error.response?.status}) detected. Initiating logout...`);
      
      // Handle unauthorized access - clear session and trigger logout
      await handleUnauthorized();
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

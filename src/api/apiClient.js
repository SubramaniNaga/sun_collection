import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { ErrorHandler } from '../utils/errorHandler';

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

    // Handle authentication errors globally
    if (error.response?.status === 401 || error.response?.status === 403) {
      try {
        // Clear all auth-related storage
        await AsyncStorage.multiRemove([
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
          'userDevice'
        ]);
        
        // Force navigation to login screen by reloading app
        // This will trigger AuthContext to re-initialize and redirect to login
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        }
      } catch (removeError) {
        console.error('Error removing auth data:', removeError);
      }
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

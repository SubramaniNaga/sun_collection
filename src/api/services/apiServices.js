import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import apiClient from '../apiClient';
import ENDPOINTS from '../endpoints';
import { clearSession } from '../../utils/sessionManager';

export const apiServices = {
  // Authentication Services
  auth: {
    login: async (credentials) => {
      try {
        // Get device ID for API call
        const deviceId = await DeviceInfo.getUniqueId();

        // Extract just the ID string if needed
        const deviceString = deviceId._j || deviceId; // Use _j property or fallback to full object

        // Prepare request payload
        const requestPayload = {
          phone: credentials.phone,
          password: credentials.password,
          // device_id: deviceString
          device_id: "12345678"
        };

        console.log('🔑 AUTH LOGIN - Request Payload:', JSON.stringify(requestPayload, null, 2));

        // Real API call
        const response = await apiClient.post(ENDPOINTS.AUTH.LOGIN, requestPayload);

        console.log('🔑 AUTH LOGIN - Raw Response:', JSON.stringify(response, null, 2));
        console.log('🔑 AUTH LOGIN - Response Data:', JSON.stringify(response.data, null, 2));

        const { token, data } = response.data;

        console.log('🔑 AUTH LOGIN - Extracted Token:', token ? 'TOKEN_RECEIVED' : 'NO_TOKEN');
        console.log('🔑 AUTH LOGIN - Extracted User Data:', JSON.stringify(data, null, 2));

        if (token && data) {
          // Store token and user data in AsyncStorage
          await AsyncStorage.setItem('authToken', token);
          await AsyncStorage.setItem('userData', JSON.stringify(data));

          // Store additional fields individually for easy access in API calls
          await AsyncStorage.setItem('userId', data.id?.toString() || '');
          await AsyncStorage.setItem('userName', data.name || '');
          await AsyncStorage.setItem('userPhone', data.phone || '');
          await AsyncStorage.setItem('userRole', data.role || '');
          await AsyncStorage.setItem('userRoleId', data.roleid?.toString() || '');
          await AsyncStorage.setItem('lineId', data.line_id?.toString() || '');
          await AsyncStorage.setItem('branchId', data.branch_id?.toString() || '');
          await AsyncStorage.setItem('userDevice', data.device || '');

          console.log('🔑 AUTH LOGIN - All auth data stored successfully');
        }

        const loginResult = {
          user: data,
          token: token,
          data: data,
          isMock: false
        };

        console.log('🔑 AUTH LOGIN - Final Result:', JSON.stringify(loginResult, null, 2));
        return loginResult;
      } catch (error) {
        console.error('🔑 AUTH LOGIN - Error Details:', JSON.stringify(error, null, 2));
        console.error('🔑 AUTH LOGIN - Error Message:', error.message);
        console.error('🔑 AUTH LOGIN - Error Response:', JSON.stringify(error.response?.data, null, 2));
        console.error('🔑 AUTH LOGIN - Error Status:', error.response?.status);
        throw error;
      }
    },

    logout: async () => {
      try {
        // Clear all session data using centralized session manager
        await clearSession();
        return { success: true };
      } catch (error) {
        console.error('Logout error:', error);
        throw error;
      }
    },

    getCurrentUser: async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        const token = await AsyncStorage.getItem('authToken');

        if (userData && token) {
          return {
            user: JSON.parse(userData),
            token: token,
            isAuthenticated: true
          };
        }

        return {
          user: null,
          token: null,
          isAuthenticated: false
        };
      } catch (error) {
        console.error('Get current user error:', error);
        return {
          user: null,
          token: null,
          isAuthenticated: false
        };
      }
    },

    refreshToken: async () => {
      try {
        const response = await apiClient.post(ENDPOINTS.AUTH.REFRESH_TOKEN);
        const { token } = response.data;

        if (token) {
          await AsyncStorage.setItem('authToken', token);
        }

        return token;
      } catch (error) {
        console.error('Refresh token error:', error);
        throw error;
      }
    }
  },

  // Customer Services
  customer: {
    createCustomer: async (formData) => {
      try {
        const response = await apiClient.post(ENDPOINTS.CUSTOMER.CREATE, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      } catch (error) {
        console.error('Create customer error:', error);
        throw error;
      }
    },

    createCustomerWithLoan: async (formData) => {
      try {
        // Get line_id and branch_id from AsyncStorage
        const lineId = await AsyncStorage.getItem('lineId');
        const branchId = await AsyncStorage.getItem('branchId');

        // Add line_id and branch_id to form data
        const formDataWithParams = new FormData();
        for (let [key, value] of formData.entries()) {
          formDataWithParams.append(key, value);
        }
        if (lineId) {
          formDataWithParams.append('line_id', lineId);
        }
        if (branchId) {
          formDataWithParams.append('branch_id', branchId);
        }

        const response = await apiClient.post(ENDPOINTS.CUSTOMER.CREATE_WITH_LOAN, formDataWithParams, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      } catch (error) {
        console.error('Create customer with loan error:', error);
        throw error;
      }
    },

    getCustomers: async () => {
      try {
        const response = await apiClient.get(ENDPOINTS.CUSTOMER.LIST);
        return response.data;
      } catch (error) {
        console.error('Get customers error:', error);
        throw error;
      }
    },

    getCustomerById: async (customerId) => {
      try {
        const response = await apiClient.get(ENDPOINTS.CUSTOMER.DETAILS(customerId));
        return response.data;
      } catch (error) {
        console.error('Get customer by ID error:', error);
        throw error;
      }
    },

    updateCustomer: async (customerId, formData) => {
      try {
        const response = await apiClient.put(ENDPOINTS.CUSTOMER.UPDATE(customerId), formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      } catch (error) {
        console.error('Update customer error:', error);
        throw error;
      }
    },

    deleteCustomer: async (customerId) => {
      try {
        const response = await apiClient.delete(ENDPOINTS.CUSTOMER.DELETE(customerId));
        return response.data;
      } catch (error) {
        console.error('Delete customer error:', error);
        throw error;
      }
    }
  },

  // Collection Services
  collection: {
    getCollectionList: async (branchId, lineId) => {
      try {
        // Get line_id and branch_id from AsyncStorage if not provided
        const storedLineId = branchId || await AsyncStorage.getItem('lineId');
        const storedBranchId = branchId || await AsyncStorage.getItem('branchId');

        // Use stored values or defaults (1) if not available
        const finalLineId = storedLineId || '1';
        const finalBranchId = storedBranchId || '1';

        const response = await apiClient.get(ENDPOINTS.COLLECTION.LIST, {
          params: {
            branch_id: finalBranchId,
            line_id: finalLineId,
          },
        });
        return response.data;
      } catch (error) {
        console.error('Get collection list error:', error);
        throw error;
      }
    }
  },

  // App Services
  app: {
    getVersion: async () => {
      try {
        const response = await apiClient.get(ENDPOINTS.APP.VERSION);
        return response.data;
      } catch (error) {
        console.error('App version check error:', error);
        throw error;
      }
    }
  }
};

// Export individual services for backward compatibility
export const authService = apiServices.auth;
export const customerService = apiServices.customer;
export const collectionService = apiServices.collection;

export default apiServices;

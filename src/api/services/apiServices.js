import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from '../../utils/deviceId';
import { clearSession } from '../../utils/sessionManager';
import apiClient from '../apiClient';
import ENDPOINTS from '../endpoints';

export const apiServices = {
  // Authentication Services
  auth: {
    login: async (credentials) => {
      try {
        // Get device ID for API call (Expo-compatible)
        const deviceString = await getDeviceId();

        // Prepare request payload
        const requestPayload = {
          phone: credentials.phone,
          password: credentials.password,
          device_id: deviceString
          // device_id: "12345678"
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

          // Temporary: if branch_id or line_id is null/string, store 1 for both
          const rawBranchId = data.branch_id;
          const rawLineId = data.line_id;
          const branchId = (rawBranchId != null && typeof rawBranchId === 'number') ? String(rawBranchId) : '1';
          const lineId = (rawLineId != null && typeof rawLineId === 'number') ? String(rawLineId) : '1';

          // Store additional fields individually for easy access in API calls
          await AsyncStorage.setItem('userId', data.id?.toString() || '');
          await AsyncStorage.setItem('userName', data.name || '');
          await AsyncStorage.setItem('userPhone', data.phone || '');
          await AsyncStorage.setItem('userRole', data.role || '');
          await AsyncStorage.setItem('userRoleId', data.roleid?.toString() || '');
          await AsyncStorage.setItem('lineId', lineId);
          await AsyncStorage.setItem('branchId', branchId);
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
        console.log('🔐 API: refreshToken - POST', ENDPOINTS.AUTH.REFRESH_TOKEN);
        const response = await apiClient.post(ENDPOINTS.AUTH.REFRESH_TOKEN);
        console.log('🔐 API: refreshToken - Response success');
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
        console.log('👤 API: createCustomer - POST', ENDPOINTS.CUSTOMER.CREATE, '| FormData keys:', [...formData.entries()].map(([k]) => k));
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
        const lineIdNum = lineId != null && lineId !== '' ? (Number(lineId) || parseInt(lineId, 10) || 1) : 1;
        const branchIdNum = branchId != null && branchId !== '' ? (Number(branchId) || parseInt(branchId, 10) || 1) : 1;
        formDataWithParams.append('line_id', lineIdNum);
        formDataWithParams.append('branch_id', branchIdNum);

        // Log payload (scalar values + file placeholders; actual file bodies are binary)
        const payloadLog = {};
        for (const [key, value] of formDataWithParams.entries()) {
          if (value != null && typeof value === 'object' && 'uri' in value && 'name' in value && 'type' in value) {
            payloadLog[key] = `[FILE] name: ${value.name}, type: ${value.type}, uri: ${value.uri?.substring?.(0, 60)}...`;
          } else {
            payloadLog[key] = value;
          }
        }
        console.log('👤 createCustomerWithLoan - PAYLOAD:', JSON.stringify(payloadLog, null, 2));
        console.log('👤 API: createCustomerWithLoan - POST', ENDPOINTS.CUSTOMER.CREATE_WITH_LOAN, '| lineId:', lineId, '| branchId:', branchId);

        const response = await apiClient.post(ENDPOINTS.CUSTOMER.CREATE_WITH_LOAN, formDataWithParams, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          transformRequest: (data, headers) => {
            delete headers['Content-Type'];
            return data;
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
        console.log('👤 API: getCustomers - GET', ENDPOINTS.CUSTOMER.LIST);
        const response = await apiClient.get(ENDPOINTS.CUSTOMER.LIST);
        console.log('👤 API: getCustomers - Response count:', response.data?.length ?? response.data?.data?.length ?? 'N/A');
        return response.data;
      } catch (error) {
        console.error('Get customers error:', error);
        throw error;
      }
    },

    searchCustomer: async (search, lineId) => {
      try {
        if (!lineId) {
          const stored = await AsyncStorage.getItem('lineId');
          lineId = stored;
        }
        const params = { search: search.trim(), line_id: lineId };
        console.log('👤 API: searchCustomer - GET', ENDPOINTS.CUSTOMER.SEARCH, '| params:', params);
        const response = await apiClient.get(ENDPOINTS.CUSTOMER.SEARCH, { params });
        return response.data;
      } catch (error) {
        console.error('Search customer error:', error);
        throw error;
      }
    },

    getCustomerById: async (customerId) => {
      try {
        console.log('👤 API: getCustomerById - GET', ENDPOINTS.CUSTOMER.DETAILS(customerId), '| customerId:', customerId);
        const response = await apiClient.get(ENDPOINTS.CUSTOMER.DETAILS(customerId));
        console.log('👤 API: getCustomerById - Response received');
        return response.data;
      } catch (error) {
        console.error('Get customer by ID error:', error);
        throw error;
      }
    },

    updateCustomer: async (customerId, formData) => {
      try {
        console.log('👤 API: updateCustomer - PUT', ENDPOINTS.CUSTOMER.UPDATE(customerId), '| customerId:', customerId);
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
        console.log('👤 API: deleteCustomer - DELETE', ENDPOINTS.CUSTOMER.DELETE(customerId), '| customerId:', customerId);
        const response = await apiClient.delete(ENDPOINTS.CUSTOMER.DELETE(customerId));
        console.log('👤 API: deleteCustomer - Response received');
        return response.data;
      } catch (error) {
        console.error('Delete customer error:', error);
        throw error;
      }
    }
  },

  // Loan Services
  loan: {
    getLoanList: async (params = {}) => {
      try {
        const branchId = await AsyncStorage.getItem('branchId');
        const lineId = await AsyncStorage.getItem('lineId');

        if (!branchId || !lineId) {
          throw new Error('Branch ID or Line ID not found. Please log in again.');
        }
        const {
          customer_id = '',
          approval_status = '',
          loan_status = '',
          page = 1,
          limit = 10,
        } = params;
        const requestParams = {
          branch_id: branchId || 1,
          line_id: lineId || 1,
          customer_id: customer_id || '',
          approval_status: approval_status || '',
          loan_status: loan_status || '',
          page,
          limit,
        };
        console.log('💰 API: getLoanList - GET', ENDPOINTS.LOAN.LIST, '| params:', JSON.stringify(requestParams, null, 2));
        const response = await apiClient.get(ENDPOINTS.LOAN.LIST, { params: requestParams });
        const list = response.data?.data ?? response.data;
        console.log('💰 API: getLoanList - Response: data length:', Array.isArray(list) ? list.length : 'N/A', '| pagination:', JSON.stringify(response.data?.pagination ?? {}));
        return response.data;
      } catch (error) {
        console.error('Get loan list error:', error);
        throw error;
      }
    },

    getNIPList: async (params = {}) => {
      try {
        const branchId = await AsyncStorage.getItem('branchId');
        const lineId = await AsyncStorage.getItem('lineId');

        if (!branchId || !lineId) {
          throw new Error('Branch ID or Line ID not found. Please log in again.');
        }
        const {
          search = '',
          page = 1,
          limit = 20,
        } = params;
        const requestParams = {
          branch_id: branchId || 1,
          line_id: lineId || 1,
          ...(search && { search }),
          page,
          limit,
        };
        console.log('🔗 API: getNIPList - GET', ENDPOINTS.LOAN.NIP, '| params:', JSON.stringify(requestParams, null, 2));
        const response = await apiClient.get(ENDPOINTS.LOAN.NIP, { params: requestParams });
        const list = response.data?.data ?? response.data;
        console.log('🔗 API: getNIPList - Response: data length:', Array.isArray(list) ? list.length : 'N/A', '| pagination:', JSON.stringify(response.data?.pagination ?? {}));
        return response.data;
      } catch (error) {
        console.error('Get NIP list error:', error);
        throw error;
      }
    }
  },

  // Collection Services
  collection: {
    getCollectionList: async (params = {}) => {
      try {
        const branchId = await AsyncStorage.getItem('branchId');
        console.log('💰 API: getCollectionList - branchId:', branchId);
        if (!branchId) {
          throw new Error('Branch ID not found. Please log in again.');
        }
        const { customer_phone = '', collection_date = '' } = params;
        const requestParams = {
          branch_id: branchId,
          ...(customer_phone && { customer_phone }),
          ...(collection_date && { collection_date }),
        };
        console.log('📋 API: getCollectionList - GET', ENDPOINTS.COLLECTION.LIST, '| params:', JSON.stringify(requestParams, null, 2));
        const response = await apiClient.get(ENDPOINTS.COLLECTION.LIST, {
          params: requestParams,
        });
        const list = response.data?.response ?? response.data?.data ?? response.data;
        console.log('📋 API: getCollectionList - Response: data length:', Array.isArray(list) ? list.length : 'N/A', '| full:', JSON.stringify(response.data, null, 2));
        return response.data;
      } catch (error) {
        console.error('Get collection list error:', error);
        throw error;
      }
    },

    updateAmount: async (collectionId, payload) => {
      try {
        const url = ENDPOINTS.COLLECTION.UPDATE_AMOUNT(collectionId);
        console.log('📋 API: updateCollectionAmount - PATCH', url, '| payload:', JSON.stringify(payload, null, 2));
        const response = await apiClient.patch(url, payload);
        return response.data;
      } catch (error) {
        console.error('Update collection amount error:', error);
        throw error;
      }
    },

    getCollectionHistory: async (params = {}) => {
      try {
        const branchId = await AsyncStorage.getItem('branchId');
        if (!branchId) {
          throw new Error('Branch ID not found. Please log in again.');
        }
        const {
          from_date = '',
          to_date = '',
          page = 1,
          limit = 10,
        } = params;
        const requestParams = {
          ...(from_date && { from_date }),
          ...(to_date && { to_date }),
          page,
          limit,
        };
        console.log('📋 API: getCollectionHistory - GET', ENDPOINTS.COLLECTION.HISTORY, '| params:', JSON.stringify(requestParams, null, 2));
        const response = await apiClient.get(ENDPOINTS.COLLECTION.HISTORY, {
          params: requestParams,
        });
        const data = response.data?.data || {};
        console.log('📋 API: getCollectionHistory - Response: collections length:', Array.isArray(data?.collections) ? data.collections.length : 'N/A', '| stats:', JSON.stringify(data?.stats ?? {}), '| pagination:', JSON.stringify(response.data?.pagination ?? {}));
        return response.data;
      } catch (error) {
        console.error('Get collection history error:', error);
        throw error;
      }
    },
  },

  // App Services
  app: {
    getVersion: async () => {
      try {
        console.log('📱 API: getVersion - GET', ENDPOINTS.APP.VERSION);
        const response = await apiClient.get(ENDPOINTS.APP.VERSION);
        console.log('📱 API: getVersion - Response:', JSON.stringify(response.data, null, 2));
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
export const loanService = apiServices.loan;

export default apiServices;

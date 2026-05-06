import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from '../../utils/deviceId';
import { clearSession } from '../../utils/sessionManager';
import apiClient from '../apiClient';
import ENDPOINTS from '../endpoints';

// Helper function to read and format line_id and branch_id for API calls
const getLineAndBranchIds = async () => {
  try {
    const branchId = await AsyncStorage.getItem('user_branch_id');
    const lineIdsJson = await AsyncStorage.getItem('user_line_ids');

    let lineIds = ['1']; // Default fallback
    if (lineIdsJson) {
      try {
        const parsed = JSON.parse(lineIdsJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lineIds = parsed;
        }
      } catch (parseError) {
        console.warn('Failed to parse line_ids JSON:', parseError);
        // Fallback to old single value
        const oldLineId = await AsyncStorage.getItem('lineId');
        if (oldLineId) {
          lineIds = [oldLineId];
        }
      }
    } else {
      // Fallback to old single value
      const oldLineId = await AsyncStorage.getItem('lineId');
      if (oldLineId) {
        lineIds = [oldLineId];
      }
    }

    return {
      branchId: branchId || '1',
      lineIds: lineIds || ['1'],
      lineIdsString: lineIds.join(',') // For query params: "1,2,3"
    };
  } catch (error) {
    console.error('Error reading line/branch IDs:', error);
    return {
      branchId: '1',
      lineIds: ['1'],
      lineIdsString: '1'
    };
  }
};

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

        // Add language to payload if provided
        if (credentials.language) {
          requestPayload.language = credentials.language;
        }

        console.log('🔑 AUTH LOGIN - Request Payload:', JSON.stringify(requestPayload, null, 2));

        // Real API call
        const response = await apiClient.post(ENDPOINTS.AUTH.LOGIN, requestPayload);

        console.log('🔑 AUTH LOGIN - Raw Response:', JSON.stringify(response, null, 2));
        console.log('🔑 AUTH LOGIN - Response Data:', JSON.stringify(response.data, null, 2));

        // Check for device conflict in successful response (code 600)
        if (response.data?.code === 600) {
          console.log('🔄 Device conflict detected in successful response');
          // Create an error object to throw for device conflict
          const conflictError = new Error(response.data?.message || 'Device conflict detected');
          conflictError.response = {
            status: response.status,
            data: response.data
          };
          throw conflictError;
        }

        const { token, data } = response.data;

        console.log('🔑 AUTH LOGIN - Extracted Token:', token ? 'TOKEN_RECEIVED' : 'NO_TOKEN');
        console.log('🔑 AUTH LOGIN - Extracted User Data:', JSON.stringify(data, null, 2));

        if (token && data) {
          // Store token and user data in AsyncStorage
          await AsyncStorage.setItem('authToken', token);
          await AsyncStorage.setItem('userData', JSON.stringify(data));

          // Store language preference if provided in response or request
          const languagePreference = data.language || data.lang || credentials.language;
          if (languagePreference) {
            await AsyncStorage.setItem('@app_language', languagePreference);
            console.log('🔑 AUTH LOGIN - Language preference stored:', languagePreference);
          }

          // Parse and store line_id and branch_id from login response
          let parsedLineIds = ['1']; // Default fallback
          let branchIdToStore = '1'; // Default fallback

          try {
            // Parse line_id - it's a JSON stringified array like "[\"1\"]" or "[\"1\",\"2\",\"3\"]"
            if (data.line_id != null && data.line_id !== '') {
              if (typeof data.line_id === 'string') {
                const parsed = JSON.parse(data.line_id);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  parsedLineIds = parsed;
                } else {
                  parsedLineIds = [data.line_id]; // Fallback to single value if parsing fails
                }
              } else if (Array.isArray(data.line_id)) {
                parsedLineIds = data.line_id;
              } else {
                parsedLineIds = [String(data.line_id)];
              }
            }

            // Handle branch_id - can be null or a value
            if (data.branch_id != null && data.branch_id !== '') {
              branchIdToStore = String(data.branch_id);
            }
          } catch (error) {
            console.warn('🔑 AUTH LOGIN - Error parsing line_id/branch_id:', error);
            // Use defaults if parsing fails
            parsedLineIds = ['1'];
            branchIdToStore = '1';
          }

          // Store the parsed line_id array and branch_id
          await AsyncStorage.setItem('user_line_ids', JSON.stringify(parsedLineIds));
          await AsyncStorage.setItem('user_branch_id', branchIdToStore);

          // Also store as single values for backward compatibility
          await AsyncStorage.setItem('lineId', parsedLineIds[0]); // First line_id for compatibility
          await AsyncStorage.setItem('branchId', branchIdToStore);

          // Store additional fields individually for easy access in API calls
          await AsyncStorage.setItem('userId', data.id?.toString() || '');
          await AsyncStorage.setItem('userName', data.name || '');
          await AsyncStorage.setItem('userPhone', data.phone || '');
          await AsyncStorage.setItem('userRole', data.role || '');
          await AsyncStorage.setItem('userRoleId', data.roleid?.toString() || '');
          await AsyncStorage.setItem('userDevice', data.device || '');

          // Store loan_type and loan_period for CustomerWithLoanScreen
          await AsyncStorage.setItem('loanType', data.loan_type?.toString() || '');
          await AsyncStorage.setItem('loanPeriod', data.loan_period?.toString() || '');

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

    changeDevice: async (mobileNo, deviceId, token = null) => {
      try {
        console.log('🔄 CHANGE DEVICE - Request:', { mobileNo, deviceId, hasToken: !!token });
        
        // Prepare headers with authorization if token is provided
        const headers = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        
        const response = await apiClient.post(ENDPOINTS.AUTH.CHANGE_DEVICE, {
          mobile_no: mobileNo,
          deviceId: deviceId
        }, { headers });

        console.log('🔄 CHANGE DEVICE - Response:', response.data);
        return response.data;
      } catch (error) {
        console.error('🔄 CHANGE DEVICE - Error:', error);
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
    },

    /**
     * Change password for the logged-in user.
     * Body keys expected by backend: current_password, new_password, userid, device_id
     */
    changePassword: async ({ currentPassword, newPassword, userid, device_id }) => {
      const body = {
        current_password: currentPassword,
        new_password: newPassword,
        userid: String(userid),
        device_id: String(device_id),
      };
      const response = await apiClient.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, body, {
        skipGlobalLoader: true,
      });
      return response.data;
    },
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
        const lineId = await AsyncStorage.getItem('lineId');
        const branchId = await AsyncStorage.getItem('branchId');

        const lineIdNum = lineId != null && lineId !== '' ? (Number(lineId) || parseInt(String(lineId), 10) || 1) : 1;
        const branchIdNum = branchId != null && branchId !== '' ? (Number(branchId) || parseInt(String(branchId), 10) || 1) : 1;
        // Match POST /customer/with-loan multipart (do not clone FormData — RN file parts break when re-built via .entries())
        formData.append('branch_id', String(branchIdNum));
        formData.append('line_id', String(lineIdNum));

        console.log(
          '👤 API: createCustomerWithLoan - POST',
          ENDPOINTS.CUSTOMER.CREATE_WITH_LOAN,
          '| branch_id:',
          branchIdNum,
          '| line_id:',
          lineIdNum,
        );

        const path = ENDPOINTS.CUSTOMER.CREATE_WITH_LOAN;
        const baseURL = apiClient.defaults?.baseURL || '';
        const fullUrl = `${baseURL}${path}`;
        const token = await AsyncStorage.getItem('authToken');

        const headers = {
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(fullUrl, {
          method: 'POST',
          headers,
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log('👤 createCustomerWithLoan - response status', response.status);
        const data = await response.json().catch(() => ({}));
        console.log('👤 createCustomerWithLoan - response data', data);

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }
        return data;
      } catch (error) {
        console.error('Create customer with loan error:', error);
        console.error('Create customer with loan - error.message:', error?.message);
        if (error.name === 'AbortError') {
          console.error('Create customer with loan - request timed out');
        }
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
        const { branchId, lineIdsString } = await getLineAndBranchIds();

        if (!branchId || !lineIdsString) {
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
          line_id: lineIdsString,
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
        const { branchId, lineIdsString } = await getLineAndBranchIds();

        if (!branchId || !lineIdsString) {
          throw new Error('Branch ID or Line ID not found. Please log in again.');
        }
        const {
          search = '',
          page = 1,
          limit = 20,
          nip_type,
        } = params;
        const requestParams = {
          branch_id: branchId || 1,
          line_id: lineIdsString,
          ...(search && { search }),
          page,
          limit,
          ...(nip_type != null && nip_type !== '' ? { nip_type } : {}),
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
    },

    getLoanTypes: async () => {
      try {
        console.log('💰 API: getLoanTypes - GET', ENDPOINTS.LOAN.TYPES);
        const response = await apiClient.get(ENDPOINTS.LOAN.TYPES);
        const data = response.data?.data ?? response.data;
        const list = Array.isArray(data) ? data : [];
        console.log('💰 API: getLoanTypes - Response: count:', list.length);
        return list;
      } catch (error) {
        console.error('Get loan types error:', error);
        throw error;
      }
    },

    getLoanDetails: async (loanId) => {
      try {
        console.log('💰 API: getLoanDetails - GET', ENDPOINTS.LOAN.DETAILS(loanId));
        const response = await apiClient.get(ENDPOINTS.LOAN.DETAILS(loanId));
        console.log('💰 API: getLoanDetails - Response success');
        return response.data;
      } catch (error) {
        console.error('Get loan details error:', error);
        throw error;
      }
    },

    createNIPCollection: async (payload) => {
      try {
        console.log('🌱 API: createNIPCollection - Payload:', JSON.stringify(payload, null, 2));

        const response = await apiClient.post(ENDPOINTS.LOAN.NIP_COLLECTION, payload);

        console.log('🌱 API: createNIPCollection - Response:', JSON.stringify(response.data, null, 2));
        return response.data;
      } catch (error) {
        console.error('Create NIP collection error:', error);
        throw error;
      }
    },

    updateLoanGiven: async (loanId, formData) => {
      try {
        const path = ENDPOINTS.LOAN.GIVEN_UPDATE(loanId);
        const baseURL = apiClient.defaults?.baseURL || '';
        const fullUrl = `${baseURL}${path}`;
        const token = await AsyncStorage.getItem('authToken');

        console.log('💰 API: updateLoanGiven - PUT', path);
        console.log('💰 API: updateLoanGiven - full URL', fullUrl);
        console.log('💰 API: updateLoanGiven - loanId', loanId);

        if (formData && typeof formData.forEach === 'function') {
          console.log('━━━━━━━━━━━━━━ [updateLoanGiven] FormData payload ━━━━━━━━━━━━');
          formData.forEach((value, key) => {
            if (value != null && typeof value === 'object' && 'uri' in value && 'name' in value && 'type' in value) {
              console.log(`  ${key}: [FILE] name=${value.name}, type=${value.type}, uri=${typeof value.uri === 'string' ? value.uri.substring(0, 80) + '...' : value.uri}`);
            } else {
              console.log(`  ${key}:`, value, `(type: ${typeof value})`);
            }
          });
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }

        const headers = {
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(fullUrl, {
          method: 'PUT',
          headers,
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log('💰 API: updateLoanGiven - response status', response.status);
        const data = await response.json().catch(() => ({}));
        console.log('💰 API: updateLoanGiven - response data', data);

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }
        return data;
      } catch (error) {
        console.error('Update loan given error:', error);
        console.error('Update loan given - error.message:', error?.message);
        if (error.name === 'AbortError') {
          console.error('Update loan given - request timed out');
        }
        throw error;
      }
    },
  },

  // Expense category (active list for expense type selection)
  expenseCategory: {
    getActiveList: async () => {
      try {
        const response = await apiClient.get(ENDPOINTS.EXPENSE_CATEGORY.ACTIVE_LIST);
        const data = response.data?.data ?? response.data;
        const list = Array.isArray(data) ? data : [];
        return list;
      } catch (error) {
        console.error('Get active expense categories error:', error);
        throw error;
      }
    },
  },

  // Expense (list with pagination + create)
  expense: {
    getList: async (params = {}) => {
      try {
        const { page = 1, limit = 10 } = params;
        const response = await apiClient.get(ENDPOINTS.EXPENSE.LIST, {
          params: { page, limit },
        });
        const raw = response.data;
        const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
        const pag = raw?.pagination ?? {};
        return {
          data: list,
          pagination: {
            currentPage: pag.currentPage ?? page,
            hasNextPage: Boolean(pag.hasNextPage),
            totalPages: pag.totalPages ?? 1,
          },
        };
      } catch (error) {
        console.error('Get expense list error:', error);
        throw error;
      }
    },

    create: async (payload) => {
      try {
        const branchId = await AsyncStorage.getItem('branchId');
        const lineId = await AsyncStorage.getItem('lineId');
        const token = await AsyncStorage.getItem('authToken');

        const formData = new FormData();
        formData.append('title', String(payload.title ?? ''));
        formData.append('category', String(payload.category ?? ''));
        formData.append('amount', String(payload.amount ?? ''));
        formData.append('date', String(payload.date ?? ''));
        formData.append('description', String(payload.description ?? ''));
        formData.append('branch_id', String(branchId ?? '1'));
        formData.append('line_id', String(lineId ?? '1'));

        if (payload.receiptImageUri) {
          const uri = typeof payload.receiptImageUri === 'object' ? payload.receiptImageUri?.uri : payload.receiptImageUri;
          if (uri) {
            const name = uri.split('/').pop()?.split('?')[0] || 'receipt_image.png';
            const type = (uri || '').toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
            formData.append('receipt_image', { uri, name, type });
          }
        }

        const path = ENDPOINTS.EXPENSE.CREATE;
        const baseURL = apiClient.defaults?.baseURL || '';
        const fullUrl = `${baseURL}${path}`;
        const headers = { ...(token && { Authorization: `Bearer ${token}` }) };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(fullUrl, {
          method: 'POST',
          headers,
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }
        return data;
      } catch (error) {
        console.error('Create expense error:', error);
        if (error.name === 'AbortError') {
          console.error('Create expense - request timed out');
        }
        throw error;
      }
    },

    deleteExpense: async (expenseId) => {
      try {
        if (expenseId == null || expenseId === '') {
          throw new Error('Expense ID is required for delete.');
        }
        console.log('🗑️ API: deleteExpense - DELETE', ENDPOINTS.EXPENSE.DELETE(expenseId));
        const response = await apiClient.delete(ENDPOINTS.EXPENSE.DELETE(expenseId));
        return response.data;
      } catch (error) {
        console.error('Delete expense error:', error);
        throw error;
      }
    },
  },

  // Collection Services
  collection: {
    getCollectionList: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();

        if (!branchId) {
          throw new Error('Branch ID not found. Please log in again.');
        }
        const { customer_phone = '', customer_name = '', collection_date = '', search = '' } = params;
        const searchTrimmed = typeof search === 'string' ? search.trim() : '';
        const requestParams = {
          branch_id: branchId,
          line_id: lineIdsString,
          ...(customer_phone && { customer_phone }),
          ...(customer_name && { customer_name }),
          ...(collection_date && { collection_date }),
          ...(searchTrimmed && { search: searchTrimmed }),
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
        const path = ENDPOINTS.COLLECTION.UPDATE_AMOUNT(collectionId);
        const baseURL = apiClient.defaults?.baseURL || '';
        const fullUrl = `${baseURL}${path}`;
        const token = await AsyncStorage.getItem('authToken');

        console.log('📋 API: updateCollectionAmount - PUT', fullUrl, '| payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(fullUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }

        return data;
      } catch (error) {
        console.error('Update collection amount error:', error);
        throw error;
      }
    },

    getCollectionHistory: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();
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
          branch_id: branchId,
          line_id: lineIdsString,
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
  },

  // Dashboard Services
  dashboard: {
    getTodayStats: async () => {
      try {
        const deviceId = await AsyncStorage.getItem('deviceId');
        const params = deviceId ? { device_id: deviceId } : {};
        console.log('📊 API: getTodayStats - GET', ENDPOINTS.DASHBOARD.TODAY, '| params:', params);
        const response = await apiClient.get(ENDPOINTS.DASHBOARD.TODAY, { params });
        console.log('📊 API: getTodayStats - Response:', JSON.stringify(response.data, null, 2));
        return response.data;
      } catch (error) {
        console.error('Get today stats error:', error);
        throw error;
      }
    },
  },

  // Collection Services
  collection: {
    getCollectionList: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();

        if (!branchId) {
          throw new Error('Branch ID not found. Please log in again.');
        }
        const { customer_phone = '', customer_name = '', collection_date = '', search = '' } = params;
        const searchTrimmed = typeof search === 'string' ? search.trim() : '';
        const requestParams = {
          branch_id: branchId,
          line_id: lineIdsString,
          ...(customer_phone && { customer_phone }),
          ...(customer_name && { customer_name }),
          ...(collection_date && { collection_date }),
          ...(searchTrimmed && { search: searchTrimmed }),
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

    // updateAmount: async (collectionId, payload) => {
    //   try {
    //     const url = ENDPOINTS.COLLECTION.UPDATE_AMOUNT(collectionId);
    //     console.log('📋 API: updateCollectionAmount - PATCH', url, '| payload:', JSON.stringify(payload, null, 2));
    //     const response = await apiClient.patch(url, payload);
    //     return response.data;
    //   } catch (error) {
    //     console.error('Update collection amount error:', error);
    //     throw error;
    //   }
    // },

    updateAmount: async (collectionId, payload) => {
      try {
        const path = ENDPOINTS.COLLECTION.UPDATE_AMOUNT(collectionId);
        const baseURL = apiClient.defaults?.baseURL || '';
        const fullUrl = `${baseURL}${path}`;
        const token = await AsyncStorage.getItem('authToken');

        console.log('📋 API: updateCollectionAmount - PUT', fullUrl, '| payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(fullUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }

        return data;
      } catch (error) {
        console.error('Update collection amount error:', error);
        throw error;
      }
    },

    getCollectionHistory: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();
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
          branch_id: branchId,
          line_id: lineIdsString,
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

    submitClosingAccount: async (payload = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();
        if (!branchId) {
          throw new Error('Branch ID not found. Please log in again.');
        }
        const body = {
          branch_id: branchId,
          line_id: lineIdsString,
          ...payload,
        };
        console.log('📋 API: submitClosingAccount - POST', ENDPOINTS.COLLECTION.CLOSING_ACCOUNT, '| body:', JSON.stringify(body, null, 2));
        const response = await apiClient.post(ENDPOINTS.COLLECTION.CLOSING_ACCOUNT, body);
        return response.data;
      } catch (error) {
        console.error('Submit closing account error:', error);
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
  },

  upfrontCash: {
    getOpeningBalance: async (params = {}) => {
      try {
        const {
          from_date = '',
          to_date = '',
          agent_id = '4',
          page = 1,
          limit = 20,
        } = params;

        const requestParams = {
          agent_id,
          ...(from_date && { from_date }),
          ...(to_date && { to_date }),
          page,
          limit,
        };

        console.log('💰 API: getOpeningBalance - Starting request');
        console.log('💰 API: Endpoint:', ENDPOINTS.UPFRONT_CASH.OPENING_BALANCE);
        console.log('💰 API: Full URL:', apiClient.defaults?.baseURL + ENDPOINTS.UPFRONT_CASH.OPENING_BALANCE);
        console.log('💰 API: Request Params:', JSON.stringify(requestParams, null, 2));
        console.log('💰 API: Query String:', new URLSearchParams(requestParams).toString());
        
        // Validate no undefined/null params
        Object.keys(requestParams).forEach(key => {
          if (requestParams[key] === undefined || requestParams[key] === null) {
            console.warn('⚠️ API Warning: Param', key, 'is', requestParams[key]);
          }
        });

        const response = await apiClient.get(ENDPOINTS.UPFRONT_CASH.OPENING_BALANCE, { params: requestParams });

        console.log('💰 API: Response Status:', response.status);
        console.log('💰 API: Response Headers:', response.headers);
        console.log('💰 API: Response Data:', JSON.stringify(response.data, null, 2));
        console.log('💰 API: Records Count:', response.data?.data?.length ?? response.data?.length ?? 'N/A');
        
        return response.data;
      } catch (error) {
        console.error('❌ API: getOpeningBalance - Error Details:');
        console.error('❌ Error Message:', error.message);
        console.error('❌ Error Status:', error.response?.status);
        console.error('❌ Error Data:', error.response?.data);
        console.error('❌ Error Config:', error.config);
        throw error;
      }
    },

    createFrontCash: async (payload) => {
      try {
        console.log('💰 API: createFrontCash - POST', ENDPOINTS.UPFRONT_CASH.LIST, '| body:', JSON.stringify(payload, null, 2));
        const response = await apiClient.post(ENDPOINTS.UPFRONT_CASH.LIST, payload);
        console.log('💰 API: createFrontCash - Response:', JSON.stringify(response.data, null, 2));
        return response.data;
      } catch (error) {
        console.error('Create front cash error:', error);
        throw error;
      }
    },

    closeOpeningAccount: async (payload = {}) => {
      try {
        console.log('💰 API: closeOpeningAccount - POST', ENDPOINTS.UPFRONT_CASH.CLOSE_ACCOUNT, '| body:', JSON.stringify(payload, null, 2));
        const response = await apiClient.post(ENDPOINTS.UPFRONT_CASH.CLOSE_ACCOUNT, payload);
        console.log('💰 API: closeOpeningAccount - Response:', JSON.stringify(response.data, null, 2));
        return response.data;
      } catch (error) {
        console.error('Close opening account error:', error);
        throw error;
      }
    },
  },

};

// Export individual services for backward compatibility
export const authService = apiServices.auth;
export const customerService = apiServices.customer;
export const collectionService = apiServices.collection;
export const loanService = apiServices.loan;
export const upfrontCashService = apiServices.upfrontCash;

export default apiServices;

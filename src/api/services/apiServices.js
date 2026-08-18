import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ATTENDANCE,
  applyAttendanceFromResponse,
  isAttendanceCheckedIn,
} from "../../config/appToggles";
import { getServerDateTimeISO } from "../../utils/dateFormatter";
import { getDeviceId } from "../../utils/deviceId";
import { notifyLocationSendResult } from "../../utils/locationTrackingNotifications";
import { registerForPushNotificationsAsync } from "../../utils/notifications";
import { clearSession } from "../../utils/sessionManager";
import apiClient from "../apiClient";
import ENDPOINTS from "../endpoints";

// Helper function to read and format line_id and branch_id for API calls
const getLineAndBranchIds = async () => {
  try {
    const branchId = await AsyncStorage.getItem("user_branch_id");
    const lineIdsJson = await AsyncStorage.getItem("user_line_ids");

    let lineIds = ["1"]; // Default fallback
    if (lineIdsJson) {
      try {
        const parsed = JSON.parse(lineIdsJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lineIds = parsed;
        }
      } catch (parseError) {
        console.warn("Failed to parse line_ids JSON:", parseError);
        // Fallback to old single value
        const oldLineId = await AsyncStorage.getItem("lineId");
        if (oldLineId) {
          lineIds = [oldLineId];
        }
      }
    } else {
      // Fallback to old single value
      const oldLineId = await AsyncStorage.getItem("lineId");
      if (oldLineId) {
        lineIds = [oldLineId];
      }
    }

    return {
      branchId: branchId || "1",
      lineIds: lineIds || ["1"],
      lineIdsString: lineIds.join(","), // For query params: "1,2,3"
    };
  } catch (error) {
    if (__DEV__) console.warn("Error reading line/branch IDs:", error);
    return {
      branchId: "1",
      lineIds: ["1"],
      lineIdsString: "1",
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
          device_id: deviceString,
          // device_id: "12345678"
        };

        // Add language to payload if provided
        if (credentials.language) {
          requestPayload.language = credentials.language;
        }

        let firebaseToken =
          credentials.firebase_token ||
          credentials.firebaseToken ||
          (await AsyncStorage.getItem("fcmToken"));

        if (!firebaseToken) {
          firebaseToken = await registerForPushNotificationsAsync();
          if (firebaseToken) {
            await AsyncStorage.setItem("fcmToken", firebaseToken);
          }
        }

        if (firebaseToken) {
          requestPayload.firebase_token = firebaseToken;
        }

        console.log(
          "🔔 AUTH LOGIN - Firebase token:",
          firebaseToken || "NOT AVAILABLE",
        );
        console.log(
          "🔑 AUTH LOGIN - Request Payload:",
          JSON.stringify(requestPayload, null, 2),
        );

        // Real API call
        const response = await apiClient.post(
          ENDPOINTS.AUTH.LOGIN,
          requestPayload,
        );

        console.log(
          "🔑 AUTH LOGIN - Raw Response:",
          JSON.stringify(response, null, 2),
        );
        console.log(
          "🔑 AUTH LOGIN - Response Data:",
          JSON.stringify(response.data, null, 2),
        );

        // Check for device conflict in successful response (code 600)
        if (response.data?.code === 600) {
          console.log("🔄 Device conflict detected in successful response");
          // Create an error object to throw for device conflict
          const conflictError = new Error(
            response.data?.message || "Device conflict detected",
          );
          conflictError.response = {
            status: response.status,
            data: response.data,
          };
          throw conflictError;
        }

        const { token, data } = response.data;

        console.log(
          "🔑 AUTH LOGIN - Extracted Token:",
          token ? "TOKEN_RECEIVED" : "NO_TOKEN",
        );
        console.log(
          "🔑 AUTH LOGIN - Extracted User Data:",
          JSON.stringify(data, null, 2),
        );

        if (token && data) {
          // Store token and user data in AsyncStorage
          await AsyncStorage.setItem("authToken", token);
          await AsyncStorage.setItem("userData", JSON.stringify(data));

          // Store language preference if provided in response or request
          const languagePreference =
            data.language || data.lang || credentials.language;
          if (languagePreference) {
            await AsyncStorage.setItem("@app_language", languagePreference);
            console.log(
              "🔑 AUTH LOGIN - Language preference stored:",
              languagePreference,
            );
          }

          // Parse and store line_id and branch_id from login response
          let parsedLineIds = ["1"]; // Default fallback
          let branchIdToStore = "1"; // Default fallback

          try {
            // Parse line_id - it's a JSON stringified array like "[\"1\"]" or "[\"1\",\"2\",\"3\"]"
            if (data.line_id != null && data.line_id !== "") {
              if (typeof data.line_id === "string") {
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
            if (data.branch_id != null && data.branch_id !== "") {
              branchIdToStore = String(data.branch_id);
            }
          } catch (error) {
            console.warn(
              "🔑 AUTH LOGIN - Error parsing line_id/branch_id:",
              error,
            );
            // Use defaults if parsing fails
            parsedLineIds = ["1"];
            branchIdToStore = "1";
          }

          // Store the parsed line_id array and branch_id
          await AsyncStorage.setItem(
            "user_line_ids",
            JSON.stringify(parsedLineIds),
          );
          await AsyncStorage.setItem("user_branch_id", branchIdToStore);

          // Also store as single values for backward compatibility
          await AsyncStorage.setItem("lineId", parsedLineIds[0]); // First line_id for compatibility
          await AsyncStorage.setItem("branchId", branchIdToStore);

          // Store additional fields individually for easy access in API calls
          await AsyncStorage.setItem("userId", data.id?.toString() || "");
          await AsyncStorage.setItem("userName", data.name || "");
          await AsyncStorage.setItem("userPhone", data.phone || "");
          await AsyncStorage.setItem("userRole", data.role || "");
          await AsyncStorage.setItem(
            "userRoleId",
            data.roleid?.toString() || "",
          );
          await AsyncStorage.setItem("userDevice", data.device || "");

          // Store loan_type for CustomerWithLoanScreen
          // loan_period is intentionally NOT stored here — it is read from the
          // dashboard response (/frontcash/dashboard/today) and stored from HomeScreen.
          await AsyncStorage.setItem(
            "loanType",
            data.loan_type?.toString() || "",
          );

          console.log("🔑 AUTH LOGIN - All auth data stored successfully");
        }

        const loginResult = {
          user: data,
          token: token,
          data: data,
          isMock: false,
        };

        console.log(
          "🔑 AUTH LOGIN - Final Result:",
          JSON.stringify(loginResult, null, 2),
        );
        return loginResult;
      } catch (error) {
        if (__DEV__)
          console.warn(
            "🔑 AUTH LOGIN - Error Details:",
            JSON.stringify(error, null, 2),
          );
        if (__DEV__)
          console.warn("🔑 AUTH LOGIN - Error Message:", error.message);
        if (__DEV__)
          console.warn(
            "🔑 AUTH LOGIN - Error Response:",
            JSON.stringify(error.response?.data, null, 2),
          );
        if (__DEV__)
          console.warn("🔑 AUTH LOGIN - Error Status:", error.response?.status);
        throw error;
      }
    },

    changeDevice: async (mobileNo, deviceId, token = null) => {
      try {
        console.log("🔄 CHANGE DEVICE - Request:", {
          mobileNo,
          deviceId,
          hasToken: !!token,
        });

        // Prepare headers with authorization if token is provided
        const headers = {
          "Content-Type": "application/json",
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await apiClient.post(
          ENDPOINTS.AUTH.CHANGE_DEVICE,
          {
            mobile_no: mobileNo,
            deviceId: deviceId,
          },
          { headers },
        );

        console.log("🔄 CHANGE DEVICE - Response:", response.data);
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("🔄 CHANGE DEVICE - Error:", error);
        throw error;
      }
    },

    logout: async () => {
      try {
        const {
          teardownLocationTrackingOnLogout,
        } = require("../../utils/locationTracker");
        await teardownLocationTrackingOnLogout();
        await clearSession();
        return { success: true };
      } catch (error) {
        if (__DEV__) console.warn("Logout error:", error);
        throw error;
      }
    },

    getCurrentUser: async () => {
      try {
        const userData = await AsyncStorage.getItem("userData");
        const token = await AsyncStorage.getItem("authToken");

        if (userData && token) {
          return {
            user: JSON.parse(userData),
            token: token,
            isAuthenticated: true,
          };
        }

        return {
          user: null,
          token: null,
          isAuthenticated: false,
        };
      } catch (error) {
        if (__DEV__) console.warn("Get current user error:", error);
        return {
          user: null,
          token: null,
          isAuthenticated: false,
        };
      }
    },

    refreshToken: async () => {
      try {
        console.log(
          "🔐 API: refreshToken - POST",
          ENDPOINTS.AUTH.REFRESH_TOKEN,
        );
        const response = await apiClient.post(ENDPOINTS.AUTH.REFRESH_TOKEN);
        console.log("🔐 API: refreshToken - Response success");
        const { token } = response.data;

        if (token) {
          await AsyncStorage.setItem("authToken", token);
        }

        return token;
      } catch (error) {
        if (__DEV__) console.warn("Refresh token error:", error);
        throw error;
      }
    },

    /**
     * Change password for the logged-in user.
     * Body keys expected by backend: current_password, new_password, userid, device_id
     */
    changePassword: async ({
      currentPassword,
      newPassword,
      userid,
      device_id,
    }) => {
      const body = {
        current_password: currentPassword,
        new_password: newPassword,
        userid: String(userid),
        device_id: String(device_id),
      };
      const response = await apiClient.post(
        ENDPOINTS.AUTH.CHANGE_PASSWORD,
        body,
        {
          skipGlobalLoader: true,
        },
      );
      return response.data;
    },
  },

  // Customer Services
  customer: {
    createCustomer: async (formData) => {
      try {
        console.log(
          "👤 API: createCustomer - POST",
          ENDPOINTS.CUSTOMER.CREATE,
          "| FormData keys:",
          [...formData.entries()].map(([k]) => k),
        );
        const response = await apiClient.post(
          ENDPOINTS.CUSTOMER.CREATE,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Create customer error:", error);
        throw error;
      }
    },

    createCustomerWithLoan: async (formData) => {
      try {
        const lineId = await AsyncStorage.getItem("lineId");
        const branchId = await AsyncStorage.getItem("branchId");

        const lineIdNum =
          lineId != null && lineId !== ""
            ? Number(lineId) || parseInt(String(lineId), 10) || 1
            : 1;
        const branchIdNum =
          branchId != null && branchId !== ""
            ? Number(branchId) || parseInt(String(branchId), 10) || 1
            : 1;
        // Match POST /customer/with-loan multipart (do not clone FormData — RN file parts break when re-built via .entries())
        formData.append("branch_id", String(branchIdNum));
        formData.append("line_id", String(lineIdNum));

        console.log(
          "👤 API: createCustomerWithLoan - POST",
          ENDPOINTS.CUSTOMER.CREATE_WITH_LOAN,
          "| branch_id:",
          branchIdNum,
          "| line_id:",
          lineIdNum,
        );

        const path = ENDPOINTS.CUSTOMER.CREATE_WITH_LOAN;
        const baseURL = apiClient.defaults?.baseURL || "";
        const fullUrl = `${baseURL}${path}`;
        const token = await AsyncStorage.getItem("authToken");

        const headers = {
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(fullUrl, {
          method: "POST",
          headers,
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log(
          "👤 createCustomerWithLoan - response status",
          response.status,
        );
        const data = await response.json().catch(() => ({}));
        console.log("👤 createCustomerWithLoan - response data", data);

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }
        return data;
      } catch (error) {
        if (__DEV__) console.warn("Create customer with loan error:", error);
        if (__DEV__)
          console.warn(
            "Create customer with loan - error.message:",
            error?.message,
          );
        if (error.name === "AbortError") {
          if (__DEV__)
            console.warn("Create customer with loan - request timed out");
        }
        throw error;
      }
    },

    getCustomers: async () => {
      try {
        console.log("👤 API: getCustomers - GET", ENDPOINTS.CUSTOMER.LIST);
        const response = await apiClient.get(ENDPOINTS.CUSTOMER.LIST);
        console.log(
          "👤 API: getCustomers - Response count:",
          response.data?.length ?? response.data?.data?.length ?? "N/A",
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get customers error:", error);
        throw error;
      }
    },

    searchCustomer: async (search, lineId, filters = {}) => {
      try {
        if (!lineId) {
          const stored = await AsyncStorage.getItem("lineId");
          lineId = stored;
        }
        const params = { search: search.trim(), line_id: lineId };
        const loanType =
          filters.loan_type != null
            ? String(filters.loan_type).trim().toLowerCase()
            : "";
        const registerDay =
          filters.register_day != null
            ? String(filters.register_day).trim()
            : "";
        if (loanType) params.loan_type = loanType;
        if (registerDay) params.register_day = registerDay;
        console.log(
          "👤 API: searchCustomer - GET",
          ENDPOINTS.CUSTOMER.SEARCH,
          "| params:",
          params,
        );
        const response = await apiClient.get(ENDPOINTS.CUSTOMER.SEARCH, {
          params,
        });
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Search customer error:", error);
        throw error;
      }
    },

    getCustomerById: async (customerId) => {
      try {
        console.log(
          "👤 API: getCustomerById - GET",
          ENDPOINTS.CUSTOMER.DETAILS(customerId),
          "| customerId:",
          customerId,
        );
        const response = await apiClient.get(
          ENDPOINTS.CUSTOMER.DETAILS(customerId),
        );
        console.log("👤 API: getCustomerById - Response received");
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get customer by ID error:", error);
        throw error;
      }
    },

    updateCustomer: async (customerId, formData) => {
      try {
        console.log(
          "👤 API: updateCustomer - PUT",
          ENDPOINTS.CUSTOMER.UPDATE(customerId),
          "| customerId:",
          customerId,
          "| FormData keys:",
          [...formData.entries()].map(([k]) => k),
        );
        const response = await apiClient.put(
          ENDPOINTS.CUSTOMER.UPDATE(customerId),
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Update customer error:", error);
        throw error;
      }
    },

    deleteCustomer: async (customerId) => {
      try {
        console.log(
          "👤 API: deleteCustomer - DELETE",
          ENDPOINTS.CUSTOMER.DELETE(customerId),
          "| customerId:",
          customerId,
        );
        const response = await apiClient.delete(
          ENDPOINTS.CUSTOMER.DELETE(customerId),
        );
        console.log("👤 API: deleteCustomer - Response received");
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Delete customer error:", error);
        throw error;
      }
    },
  },

  // Loan Services
  loan: {
    getLoanList: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();

        if (!branchId || !lineIdsString) {
          throw new Error(
            "Branch ID or Line ID not found. Please log in again.",
          );
        }
        const {
          customer_id = "",
          search = "",
          approval_status = "",
          loan_status = "",
          register_day = "",
          page = 1,
          limit = 10,
        } = params;
        const registerDay =
          register_day != null ? String(register_day).trim() : "";
        const searchTerm = search != null ? String(search).trim() : "";
        const requestParams = {
          branch_id: branchId || 1,
          line_id: lineIdsString,
          customer_id: customer_id || "",
          approval_status: approval_status || "",
          loan_status: loan_status || "",
          page,
          limit,
          ...(registerDay ? { register_day: registerDay } : {}),
          ...(searchTerm ? { search: searchTerm } : {}),
        };
        console.log(
          "💰 API: getLoanList - GET",
          ENDPOINTS.LOAN.LIST,
          "| params:",
          JSON.stringify(requestParams, null, 2),
        );
        const response = await apiClient.get(ENDPOINTS.LOAN.LIST, {
          params: requestParams,
        });
        const list = response.data?.data ?? response.data;
        console.log(
          "💰 API: getLoanList - Response: data length:",
          Array.isArray(list) ? list.length : "N/A",
          "| pagination:",
          JSON.stringify(response.data?.pagination ?? {}),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get loan list error:", error);
        throw error;
      }
    },

    getNIPList: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();

        if (!branchId || !lineIdsString) {
          throw new Error(
            "Branch ID or Line ID not found. Please log in again.",
          );
        }
        const { search = "", page = 1, limit = 20, nip_type } = params;
        const requestParams = {
          branch_id: branchId || 1,
          line_id: lineIdsString,
          ...(search && { search }),
          page,
          limit,
          ...(nip_type != null && nip_type !== "" ? { nip_type } : {}),
        };
        console.log(
          "🔗 API: getNIPList - GET",
          ENDPOINTS.LOAN.NIP,
          "| params:",
          JSON.stringify(requestParams, null, 2),
        );
        const response = await apiClient.get(ENDPOINTS.LOAN.NIP, {
          params: requestParams,
        });
        const list = response.data?.data ?? response.data;
        console.log(
          "🔗 API: getNIPList - Response: data length:",
          Array.isArray(list) ? list.length : "N/A",
          "| pagination:",
          JSON.stringify(response.data?.pagination ?? {}),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get NIP list error:", error);
        throw error;
      }
    },

    getLoanTypes: async () => {
      try {
        console.log("💰 API: getLoanTypes - GET", ENDPOINTS.LOAN.TYPES);
        const response = await apiClient.get(ENDPOINTS.LOAN.TYPES);
        const data = response.data?.data ?? response.data;
        const list = Array.isArray(data) ? data : [];
        console.log("💰 API: getLoanTypes - Response: count:", list.length);
        return list;
      } catch (error) {
        if (__DEV__) console.warn("Get loan types error:", error);
        throw error;
      }
    },

    getLoanDetails: async (loanId) => {
      try {
        console.log(
          "💰 API: getLoanDetails - GET",
          ENDPOINTS.LOAN.DETAILS(loanId),
        );
        const response = await apiClient.get(ENDPOINTS.LOAN.DETAILS(loanId));
        console.log("💰 API: getLoanDetails - Response success");
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get loan details error:", error);
        throw error;
      }
    },

    createNIPCollection: async (payload) => {
      try {
        console.log(
          "🌱 API: createNIPCollection - Payload:",
          JSON.stringify(payload, null, 2),
        );

        const response = await apiClient.post(
          ENDPOINTS.LOAN.NIP_COLLECTION,
          payload,
        );

        console.log(
          "🌱 API: createNIPCollection - Response:",
          JSON.stringify(response.data, null, 2),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Create NIP collection error:", error);
        throw error;
      }
    },

    renewLoan: async (payload) => {
      try {
        console.log(
          "💰 API: renewLoan - POST",
          ENDPOINTS.LOAN.RENEWAL,
          "| payload:",
          JSON.stringify(payload, null, 2),
        );
        const response = await apiClient.post(ENDPOINTS.LOAN.RENEWAL, payload);
        console.log(
          "💰 API: renewLoan - Response:",
          JSON.stringify(response.data, null, 2),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Renew loan error:", error);
        throw error;
      }
    },

    updateLoanGiven: async (loanId, formData) => {
      try {
        const path = ENDPOINTS.LOAN.GIVEN_UPDATE(loanId);
        const baseURL = apiClient.defaults?.baseURL || "";
        const fullUrl = `${baseURL}${path}`;
        const token = await AsyncStorage.getItem("authToken");

        console.log("💰 API: updateLoanGiven - PUT", path);
        console.log("💰 API: updateLoanGiven - full URL", fullUrl);
        console.log("💰 API: updateLoanGiven - loanId", loanId);

        if (formData && typeof formData.forEach === "function") {
          console.log(
            "━━━━━━━━━━━━━━ [updateLoanGiven] FormData payload ━━━━━━━━━━━━",
          );
          formData.forEach((value, key) => {
            if (
              value != null &&
              typeof value === "object" &&
              "uri" in value &&
              "name" in value &&
              "type" in value
            ) {
              console.log(
                `  ${key}: [FILE] name=${value.name}, type=${value.type}, uri=${typeof value.uri === "string" ? value.uri.substring(0, 80) + "..." : value.uri}`,
              );
            } else {
              console.log(`  ${key}:`, value, `(type: ${typeof value})`);
            }
          });
          console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          );
        }

        const headers = {
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(fullUrl, {
          method: "PUT",
          headers,
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log(
          "💰 API: updateLoanGiven - response status",
          response.status,
        );
        const data = await response.json().catch(() => ({}));
        console.log("💰 API: updateLoanGiven - response data", data);

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }
        return data;
      } catch (error) {
        if (__DEV__) console.warn("Update loan given error:", error);
        if (__DEV__)
          console.warn("Update loan given - error.message:", error?.message);
        if (error.name === "AbortError") {
          if (__DEV__) console.warn("Update loan given - request timed out");
        }
        throw error;
      }
    },
  },

  // Expense category (active list for expense type selection)
  // expenseCategory: {
  //   getActiveList: async () => {
  //     try {
  //        const userId = await AsyncStorage.getItem('userId');
  //        const params = {};
  //        if (userId && String(userId).trim()) {
  //          params.user_id = String(userId).trim();
  //        }
  //        const response = await apiClient.get(ENDPOINTS.EXPENSE_CATEGORY.ACTIVE_LIST, { params });
  //       const response = await apiClient.get(ENDPOINTS.EXPENSE_CATEGORY.ACTIVE_LIST);
  //       const data = response.data?.data ?? response.data;
  //       const list = Array.isArray(data) ? data : [];
  //       return list;
  //     } catch (error) {
  //       if (__DEV__) console.warn('Get active expense categories error:', error);
  //       throw error;
  //     }
  //   },
  // },

  expenseCategory: {
    getActiveList: async () => {
      try {
        const response = await apiClient.get(
          ENDPOINTS.EXPENSE_CATEGORY.ACTIVE_LIST,
        );
        const data = response.data?.data ?? response.data;
        const list = Array.isArray(data) ? data : [];
        return list;
      } catch (error) {
        if (__DEV__)
          console.warn("Get active expense categories error:", error);
        throw error;
      }
    },
  },

  city: {
    getActiveList: async () => {
      try {
        const { branchId } = await getLineAndBranchIds();
        const params = { branch_id: branchId || 1 };
        console.log(
          "🏙️ API: getActiveCities - GET",
          ENDPOINTS.CITY.ACTIVE_LIST,
          "| params:",
          params,
        );
        const response = await apiClient.get(ENDPOINTS.CITY.ACTIVE_LIST, {
          params,
          skipGlobalLoader: true,
        });
        const raw = response.data?.data ?? response.data;
        const list = Array.isArray(raw) ? raw : [];
        return list.map((item) => ({
          id: item.id,
          city_name: item.city_name,
        }));
      } catch (error) {
        if (__DEV__) console.warn("Get active cities error:", error);
        throw error;
      }
    },
    create: async (cityName) => {
      try {
        const { branchId } = await getLineAndBranchIds();
        const payload = {
          city_name: String(cityName || "").trim(),
          branch_id: Number(branchId) || 1,
          active: 1,
        };
        console.log(
          "🏙️ API: createCity - POST",
          ENDPOINTS.CITY.CREATE,
          "| payload:",
          payload,
        );
        const response = await apiClient.post(ENDPOINTS.CITY.CREATE, payload, {
          skipGlobalLoader: true,
        });
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Create city error:", error);
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
        const list = Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
            ? raw
            : [];
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
        if (__DEV__) console.warn("Get expense list error:", error);
        throw error;
      }
    },

    create: async (payload) => {
      try {
        const branchId = await AsyncStorage.getItem("branchId");
        const lineId = await AsyncStorage.getItem("lineId");
        const token = await AsyncStorage.getItem("authToken");

        const formData = new FormData();
        formData.append("title", String(payload.title ?? ""));
        formData.append("category", String(payload.category ?? ""));
        formData.append("amount", String(payload.amount ?? ""));
        formData.append("date", String(payload.date ?? ""));
        formData.append("description", String(payload.description ?? ""));
        formData.append("branch_id", String(branchId ?? "1"));
        formData.append("line_id", String(lineId ?? "1"));
        if (payload.lineuser != null && payload.lineuser !== "") {
          formData.append("lineuser", String(payload.lineuser));
        }

        if (payload.receiptImageUri) {
          const uri =
            typeof payload.receiptImageUri === "object"
              ? payload.receiptImageUri?.uri
              : payload.receiptImageUri;
          if (uri) {
            const name =
              uri.split("/").pop()?.split("?")[0] || "receipt_image.png";
            const type = (uri || "").toLowerCase().includes(".png")
              ? "image/png"
              : "image/jpeg";
            formData.append("receipt_image", { uri, name, type });
          }
        }

        const receiptUri = payload.receiptImageUri
          ? typeof payload.receiptImageUri === "object"
            ? payload.receiptImageUri?.uri
            : payload.receiptImageUri
          : null;
        console.log("💰 API: expense.create - POST", ENDPOINTS.EXPENSE.CREATE);
        console.log(
          "💰 API: expense.create - FormData fields:",
          JSON.stringify(
            {
              title: payload.title ?? "",
              category: payload.category ?? "",
              amount: payload.amount ?? "",
              date: payload.date ?? "",
              description: payload.description ?? "",
              branch_id: String(branchId ?? "1"),
              line_id: String(lineId ?? "1"),
              lineuser:
                payload.lineuser != null && payload.lineuser !== ""
                  ? String(payload.lineuser)
                  : null,
              receipt_image: receiptUri
                ? {
                    uri: receiptUri,
                    name:
                      receiptUri.split("/").pop()?.split("?")[0] ||
                      "receipt_image.png",
                  }
                : null,
            },
            null,
            2,
          ),
        );

        const path = ENDPOINTS.EXPENSE.CREATE;
        const baseURL = apiClient.defaults?.baseURL || "";
        const fullUrl = `${baseURL}${path}`;
        const headers = { ...(token && { Authorization: `Bearer ${token}` }) };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(fullUrl, {
          method: "POST",
          headers,
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json().catch(() => ({}));
        console.log(
          "💰 API: expense.create - response:",
          JSON.stringify(data, null, 2),
        );

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }
        return data;
      } catch (error) {
        if (__DEV__) console.warn("Create expense error:", error);
        if (error.name === "AbortError") {
          if (__DEV__) console.warn("Create expense - request timed out");
        }
        throw error;
      }
    },

    deleteExpense: async (expenseId) => {
      try {
        if (expenseId == null || expenseId === "") {
          throw new Error("Expense ID is required for delete.");
        }
        console.log(
          "🗑️ API: deleteExpense - DELETE",
          ENDPOINTS.EXPENSE.DELETE(expenseId),
        );
        const response = await apiClient.delete(
          ENDPOINTS.EXPENSE.DELETE(expenseId),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Delete expense error:", error);
        throw error;
      }
    },
  },

  /** GET /branch-users?branch_id= — users with lines for expense lineuser picker */
  branchUsers: {
    getList: async (branchId) => {
      try {
        const id = branchId ?? (await AsyncStorage.getItem("branchId"));
        if (!id) {
          throw new Error("Branch ID not found. Please log in again.");
        }
        const response = await apiClient.get(ENDPOINTS.BRANCH_USERS.LIST, {
          params: { branch_id: id },
        });
        const body = response.data;
        const data = body?.data ?? body;
        const users = Array.isArray(data?.users) ? data.users : [];
        return users;
      } catch (error) {
        if (__DEV__) console.warn("Get branch users error:", error);
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
          throw new Error("Branch ID not found. Please log in again.");
        }
        const {
          customer_phone = "",
          customer_name = "",
          collection_date = "",
          search = "",
        } = params;
        const searchTrimmed = typeof search === "string" ? search.trim() : "";
        const requestParams = {
          branch_id: branchId,
          line_id: lineIdsString,
          ...(customer_phone && { customer_phone }),
          ...(customer_name && { customer_name }),
          ...(collection_date && { collection_date }),
          ...(searchTrimmed && { search: searchTrimmed }),
        };
        console.log(
          "📋 API: getCollectionList - GET",
          ENDPOINTS.COLLECTION.LIST,
          "| params:",
          JSON.stringify(requestParams, null, 2),
        );
        const response = await apiClient.get(ENDPOINTS.COLLECTION.LIST, {
          params: requestParams,
        });
        const list =
          response.data?.response ?? response.data?.data ?? response.data;
        console.log(
          "📋 API: getCollectionList - Response: data length:",
          Array.isArray(list) ? list.length : "N/A",
          "| full:",
          JSON.stringify(response.data, null, 2),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get collection list error:", error);
        throw error;
      }
    },

    updateAmount: async (collectionId, payload) => {
      try {
        const path = ENDPOINTS.COLLECTION.UPDATE_AMOUNT(collectionId);
        const baseURL = apiClient.defaults?.baseURL || "";
        const fullUrl = `${baseURL}${path}`;
        const token = await AsyncStorage.getItem("authToken");

        console.log(
          "📋 API: updateCollectionAmount - PUT",
          fullUrl,
          "| payload:",
          JSON.stringify(payload, null, 2),
        );

        const response = await fetch(fullUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }

        return data;
      } catch (error) {
        if (__DEV__) console.warn("Update collection amount error:", error);
        throw error;
      }
    },

    getCollectionHistory: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();
        if (!branchId) {
          throw new Error("Branch ID not found. Please log in again.");
        }
        const { from_date = "", to_date = "", page = 1, limit = 10 } = params;
        const requestParams = {
          branch_id: branchId,
          line_id: lineIdsString,
          ...(from_date && { from_date }),
          ...(to_date && { to_date }),
          page,
          limit,
        };
        console.log(
          "📋 API: getCollectionHistory - GET",
          ENDPOINTS.COLLECTION.HISTORY,
          "| params:",
          JSON.stringify(requestParams, null, 2),
        );
        const response = await apiClient.get(ENDPOINTS.COLLECTION.HISTORY, {
          params: requestParams,
        });
        const data = response.data?.data || {};
        console.log(
          "📋 API: getCollectionHistory - Response: collections length:",
          Array.isArray(data?.collections) ? data.collections.length : "N/A",
          "| stats:",
          JSON.stringify(data?.stats ?? {}),
          "| pagination:",
          JSON.stringify(response.data?.pagination ?? {}),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get collection history error:", error);
        throw error;
      }
    },
  },

  // App Services
  app: {
    getVersion: async (options = {}) => {
      try {
        console.log("📱 API: getVersion - GET", ENDPOINTS.APP.VERSION);
        const response = await apiClient.get(ENDPOINTS.APP.VERSION, {
          skipGlobalLoader: Boolean(options.skipGlobalLoader),
        });
        console.log(
          "📱 API: getVersion - Response:",
          JSON.stringify(response.data, null, 2),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("App version check error:", error);
        throw error;
      }
    },
  },

  // Dashboard Services
  dashboard: {
    getTodayStats: async (options = {}) => {
      try {
        const deviceId = await AsyncStorage.getItem("deviceId");
        const params = deviceId ? { device_id: deviceId } : {};
        // console.log('📊 API: getTodayStats - GET', ENDPOINTS.DASHBOARD.TODAY, '| params:', params);
        const response = await apiClient.get(ENDPOINTS.DASHBOARD.TODAY, {
          params,
          skipGlobalLoader: Boolean(options.skipGlobalLoader),
        });
        // console.log('📊 API: getTodayStats - Response:', JSON.stringify(response.data, null, 2));
        return response.data;
      } catch (error) {
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
          throw new Error("Branch ID not found. Please log in again.");
        }
        const {
          customer_phone = "",
          customer_name = "",
          collection_date = "",
          search = "",
          registered_day = "",
          customer_id = "",
          page,
          limit,
        } = params;
        const searchTrimmed = typeof search === "string" ? search.trim() : "";
        const requestParams = {
          branch_id: branchId,
          line_id: lineIdsString,
          ...(customer_phone && { customer_phone }),
          ...(customer_name && { customer_name }),
          ...(collection_date && { collection_date }),
          ...(searchTrimmed && { search: searchTrimmed }),
          ...(registered_day && { registered_day }),
          ...(customer_id && { customer_id }),
          ...(page != null && { page }),
          ...(limit != null && { limit }),
        };
        console.log(
          "📋 API: getCollectionList - GET",
          ENDPOINTS.COLLECTION.LIST,
          "| params:",
          requestParams,
        );
        const response = await apiClient.get(ENDPOINTS.COLLECTION.LIST, {
          params: requestParams,
        });
        const list =
          response.data?.response ?? response.data?.data ?? response.data;
        console.log(
          "📋 API: getCollectionList - Response: data length:",
          Array.isArray(list) ? list.length : "N/A",
          "| full:",
          response.data,
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get collection list error:", error);
        throw error;
      }
    },

    getUnpaidCollections: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();
        if (!branchId) {
          throw new Error("Branch ID not found. Please log in again.");
        }
        const {
          page = 1,
          limit = 10,
          collection_date = "",
          customer_phone = "",
          search = "",
          customer_id = "",
          loan_type = "",
        } = params;
        const searchTrimmed = typeof search === "string" ? search.trim() : "";
        const requestParams = {
          page,
          limit,
          branch_id: branchId,
          line_id: lineIdsString,
          ...(collection_date && { collection_date }),
          ...(customer_phone && { customer_phone }),
          ...(searchTrimmed && { search: searchTrimmed }),
          ...(customer_id && { customer_id }),
          ...(loan_type && { loan_type }),
        };
        console.log(
          "📋 API: getUnpaidCollections - GET",
          ENDPOINTS.COLLECTION.UNPAID_LIST,
          "| params:",
          requestParams,
        );
        const response = await apiClient.get(ENDPOINTS.COLLECTION.UNPAID_LIST, {
          params: requestParams,
        });
        const collections = response.data?.data?.collections ?? [];
        const list = Array.isArray(collections) ? collections : [];
        console.log(
          "📋 API: getUnpaidCollections - count:",
          list.length,
          "| pagination:",
          JSON.stringify(response.data?.pagination ?? {}),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get unpaid collections error:", error);
        throw error;
      }
    },

    getPaidCollections: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();
        if (!branchId) {
          throw new Error("Branch ID not found. Please log in again.");
        }
        const {
          page = 1,
          limit = 20,
          collection_date = "",
          customer_phone = "",
          search = "",
          customer_id = "",
          loan_type = "",
        } = params;
        const searchTrimmed = typeof search === "string" ? search.trim() : "";
        const requestParams = {
          page,
          limit,
          branch_id: branchId,
          line_id: lineIdsString,
          ...(collection_date && { collection_date }),
          ...(customer_phone && { customer_phone }),
          ...(searchTrimmed && { search: searchTrimmed }),
          ...(customer_id && { customer_id }),
          ...(loan_type && { loan_type }),
        };
        console.log(
          "📋 API: getPaidCollections - GET",
          ENDPOINTS.COLLECTION.PAID_LIST,
          "| params:",
          requestParams,
        );
        const response = await apiClient.get(ENDPOINTS.COLLECTION.PAID_LIST, {
          params: requestParams,
        });
        const collections = response.data?.data?.collections ?? [];
        const list = Array.isArray(collections) ? collections : [];
        console.log(
          "📋 API: getPaidCollections - count:",
          list.length,
          "| pagination:",
          JSON.stringify(response.data?.pagination ?? {}),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get paid collections error:", error);
        throw error;
      }
    },

    getDelayedCollections: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();
        if (!branchId) {
          throw new Error("Branch ID not found. Please log in again.");
        }
        const {
          page = 1,
          limit = 20,
          delay_unit = "weeks",
          search = "",
        } = params;
        const searchTrimmed = typeof search === "string" ? search.trim() : "";
        const requestParams = {
          branch_id: branchId,
          line_id: lineIdsString,
          delay_unit,
          page,
          limit,
          ...(searchTrimmed && { search: searchTrimmed }),
        };
        console.log(
          "📋 API: getDelayedCollections - GET",
          ENDPOINTS.COLLECTION.DELAY_LIST,
          "| params:",
          requestParams,
        );
        const response = await apiClient.get(ENDPOINTS.COLLECTION.DELAY_LIST, {
          params: requestParams,
        });
        const collections =
          response.data?.data?.collections ?? response.data?.data ?? [];
        const list = Array.isArray(collections) ? collections : [];
        console.log(
          "📋 API: getDelayedCollections - count:",
          list.length,
          "| pagination:",
          JSON.stringify(response.data?.pagination ?? {}),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get delayed collections error:", error);
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
    //     if (__DEV__) console.warn('Update collection amount error:', error);
    //     throw error;
    //   }
    // },

    updateAmount: async (collectionId, payload) => {
      try {
        const path = ENDPOINTS.COLLECTION.UPDATE_AMOUNT(collectionId);
        const baseURL = apiClient.defaults?.baseURL || "";
        const fullUrl = `${baseURL}${path}`;
        const token = await AsyncStorage.getItem("authToken");

        console.log(
          "📋 API: updateCollectionAmount - PUT",
          fullUrl,
          "| payload:",
          JSON.stringify(payload, null, 2),
        );

        const response = await fetch(fullUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        console.log("📋 API: updateCollectionAmount - FULL response:");
        console.log("📋 HTTP status:", response.status, "| ok:", response.ok);
        console.log(JSON.stringify(data, null, 2));

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }

        return data;
      } catch (error) {
        if (__DEV__) console.warn("Update collection amount error:", error);
        throw error;
      }
    },

    getCollectionHistory: async (params = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();
        if (!branchId) {
          throw new Error("Branch ID not found. Please log in again.");
        }
        const { from_date = "", to_date = "", page = 1, limit = 10 } = params;
        const requestParams = {
          branch_id: branchId,
          line_id: lineIdsString,
          ...(from_date && { from_date }),
          ...(to_date && { to_date }),
          page,
          limit,
        };
        console.log(
          "📋 API: getCollectionHistory - GET",
          ENDPOINTS.COLLECTION.HISTORY,
          "| params:",
          JSON.stringify(requestParams, null, 2),
        );
        const response = await apiClient.get(ENDPOINTS.COLLECTION.HISTORY, {
          params: requestParams,
        });
        const data = response.data?.data || {};
        console.log(
          "📋 API: getCollectionHistory - Response: collections length:",
          Array.isArray(data?.collections) ? data.collections.length : "N/A",
          "| stats:",
          JSON.stringify(data?.stats ?? {}),
          "| pagination:",
          JSON.stringify(response.data?.pagination ?? {}),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Get collection history error:", error);
        throw error;
      }
    },

    submitClosingAccount: async (payload = {}) => {
      try {
        const { branchId, lineIdsString } = await getLineAndBranchIds();
        if (!branchId) {
          throw new Error("Branch ID not found. Please log in again.");
        }
        const body = {
          branch_id: branchId,
          line_id: lineIdsString,
          ...payload,
        };
        console.log(
          "📋 API: submitClosingAccount - POST",
          ENDPOINTS.COLLECTION.CLOSING_ACCOUNT,
          "| body:",
          JSON.stringify(body, null, 2),
        );
        const response = await apiClient.post(
          ENDPOINTS.COLLECTION.CLOSING_ACCOUNT,
          body,
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Submit closing account error:", error);
        throw error;
      }
    },
  },

  upfrontCash: {
    getOpeningBalance: async (params = {}) => {
      try {
        const {
          from_date = "",
          to_date = "",
          agent_id = "4",
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

        console.log("💰 API: getOpeningBalance - Starting request");
        console.log(
          "💰 API: Endpoint:",
          ENDPOINTS.UPFRONT_CASH.OPENING_BALANCE,
        );
        console.log(
          "💰 API: Full URL:",
          apiClient.defaults?.baseURL + ENDPOINTS.UPFRONT_CASH.OPENING_BALANCE,
        );
        console.log(
          "💰 API: Request Params:",
          JSON.stringify(requestParams, null, 2),
        );
        console.log(
          "💰 API: Query String:",
          new URLSearchParams(requestParams).toString(),
        );

        // Validate no undefined/null params
        Object.keys(requestParams).forEach((key) => {
          if (requestParams[key] === undefined || requestParams[key] === null) {
            console.warn(
              "⚠️ API Warning: Param",
              key,
              "is",
              requestParams[key],
            );
          }
        });

        const response = await apiClient.get(
          ENDPOINTS.UPFRONT_CASH.OPENING_BALANCE,
          { params: requestParams },
        );

        console.log("💰 API: Response Status:", response.status);
        console.log("💰 API: Response Headers:", response.headers);
        console.log(
          "💰 API: Response Data:",
          JSON.stringify(response.data, null, 2),
        );
        console.log(
          "💰 API: Records Count:",
          response.data?.data?.length ?? response.data?.length ?? "N/A",
        );

        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("❌ API: getOpeningBalance - Error Details:");
        if (__DEV__) console.warn("❌ Error Message:", error.message);
        if (__DEV__) console.warn("❌ Error Status:", error.response?.status);
        if (__DEV__) console.warn("❌ Error Data:", error.response?.data);
        if (__DEV__) console.warn("❌ Error Config:", error.config);
        throw error;
      }
    },

    createFrontCash: async (payload) => {
      try {
        console.log(
          "💰 API: createFrontCash - POST",
          ENDPOINTS.UPFRONT_CASH.CREATE,
          "| body:",
          JSON.stringify(payload, null, 2),
        );
        const response = await apiClient.post(
          ENDPOINTS.UPFRONT_CASH.CREATE,
          payload,
        );
        console.log(
          "💰 API: createFrontCash - Response:",
          JSON.stringify(response.data, null, 2),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Create front cash error:", error);
        throw error;
      }
    },

    closeOpeningAccount: async (payload = {}) => {
      try {
        console.log(
          "💰 API: closeOpeningAccount - POST",
          ENDPOINTS.UPFRONT_CASH.CLOSE_ACCOUNT,
          "| body:",
          JSON.stringify(payload, null, 2),
        );
        const response = await apiClient.post(
          ENDPOINTS.UPFRONT_CASH.CLOSE_ACCOUNT,
          payload,
        );
        console.log(
          "💰 API: closeOpeningAccount - Response:",
          JSON.stringify(response.data, null, 2),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Close opening account error:", error);
        throw error;
      }
    },
  },

  companyVaravu: {
    create: async (payload) => {
      try {
        console.log(
          "🏢 API: companyVaravu.create - POST",
          ENDPOINTS.COMPANY_VARAVU.CREATE,
          "| body:",
          JSON.stringify(payload, null, 2),
        );
        const response = await apiClient.post(
          ENDPOINTS.COMPANY_VARAVU.CREATE,
          payload,
        );
        console.log(
          "🏢 API: companyVaravu.create - Response:",
          JSON.stringify(response.data, null, 2),
        );
        return response.data;
      } catch (error) {
        if (__DEV__) console.warn("Create company varavu error:", error);
        throw error;
      }
    },
  },

  attendance: {
    /** Mark attendance. multipart FormData: user_id, status, time, latitude, longitude, address, image */
    markPresent: async (formData) => {
      try {
        const path = ENDPOINTS.ATTENDANCE.MARK;
        const baseURL = apiClient.defaults?.baseURL || "";
        const fullUrl = `${baseURL}${path}`;
        const token = await AsyncStorage.getItem("authToken");

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📤 API REQUEST [POST]", token + " \n " + fullUrl);
        if (formData && typeof formData.forEach === "function") {
          const keys = [];
          formData.forEach((_, key) => keys.push(key));
          console.log(
            "📤 Request body: FormData (multipart), keys:",
            keys.join(", "),
          );
          formData.forEach((value, key) => {
            if (
              value != null &&
              typeof value === "object" &&
              "uri" in value &&
              "name" in value
            ) {
              console.log(
                `📤   ${key}: [FILE] name=${value.name}, type=${value.type || "n/a"}, uri=${
                  typeof value.uri === "string"
                    ? value.uri.substring(0, 70) + "..."
                    : value.uri
                }`,
              );
            } else {
              console.log(`📤   ${key}:`, value);
            }
          });
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        // Use fetch so RN sets multipart boundary (axios Content-Type breaks file uploads)
        const response = await fetch(fullUrl, {
          method: "POST",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: formData,
        });

        const data = await response.json().catch(() => ({}));

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(
          "📥 API RESPONSE [POST]",
          path,
          "| Status:",
          response.status,
        );
        console.log("📥 Response data:", JSON.stringify(data, null, 2));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if (!response.ok) {
          const err = new Error(data?.message || `HTTP ${response.status}`);
          err.response = { status: response.status, data };
          throw err;
        }
        return data;
      } catch (error) {
        if (__DEV__) console.warn("Mark attendance error:", error);
        throw error;
      }
    },
  },

  /** POST /attendance/location-tracking — only while checked in; no global loader */
  location: {
    send: async ({ user_id, latitude, longitude, location, time } = {}) => {
      try {
        const authToken = await AsyncStorage.getItem("authToken");
        if (!authToken) {
          return { success: false, skipped: true, reason: "no_session" };
        }

        // Headless / closed app: restore check-in flags from storage before gate.
        try {
          const pairs = await AsyncStorage.multiGet([
            "attendance_allow_location",
            "attendance_capture_time",
            "attendance_status",
          ]);
          const allow = pairs?.[0]?.[1];
          const capture = pairs?.[1]?.[1];
          const status = pairs?.[2]?.[1];
          if (allow === "0" || allow === "1") {
            ATTENDANCE.allow_location = Number(allow);
          }
          if (capture != null && Number.isFinite(Number(capture))) {
            ATTENDANCE.capture_time = Number(capture);
          }
          if (status != null && Number.isFinite(Number(status))) {
            ATTENDANCE.attendance_status = Number(status);
          }
        } catch (e) {
          // ignore — use in-memory ATTENDANCE
        }

        if (
          ATTENDANCE.allow_location !== 1 ||
          !isAttendanceCheckedIn() ||
          Number(ATTENDANCE.capture_time) <= 0
        ) {
          return { success: false, skipped: true };
        }

        const storedUserId = await AsyncStorage.getItem("userId");
        const finalUserId =
          user_id ?? (storedUserId != null ? Number(storedUserId) : null);
        const payload = {
          user_id: finalUserId,
          latitude,
          longitude,
          location: location || "",
          time: time || getServerDateTimeISO(),
        };
        if (__DEV__) {
          console.log(
            `[location.track] POST /location-tracking @ ${payload.time} (capture_time=${ATTENDANCE.capture_time}m)`,
          );
        }
        const response = await apiClient.post(
          ENDPOINTS.LOCATION.TRACK,
          payload,
          {
            skipGlobalLoader: true,
            skipApiLog: true,
          },
        );
        const data = response.data;
        if (__DEV__) {
          console.log(
            "[location.track] response:",
            JSON.stringify(data, null, 2),
          );
        }
        applyAttendanceFromResponse(data);
        const successMessage =
          data?.message ||
          (data?.success === false
            ? "Location update rejected by server."
            : "Location update posted.");
        await notifyLocationSendResult({
          success: data?.success !== false,
          message: successMessage,
        });

        const {
          syncLocationTracking,
          persistLocationTrackingFlags,
        } = require("../../utils/locationTracker");
        await persistLocationTrackingFlags();
        if (ATTENDANCE.allow_location !== 1 || !isAttendanceCheckedIn()) {
          await syncLocationTracking();
        }
        return data;
      } catch (error) {
        applyAttendanceFromResponse(error?.response?.data);
        const msg = error?.response?.data?.message;
        const companyOff =
          error?.response?.data?.allow_location === 0 ||
          error?.response?.data?.attendance?.allow_location === 0;
        const notCheckedIn =
          msg ===
            "Location tracking allowed only after check-in and before checkout" ||
          error?.response?.data?.user_allow_location === 0 ||
          error?.response?.data?.attendance?.user_allow_location === 0;

        if (companyOff) {
          ATTENDANCE.allow_location = 0;
          try {
            const {
              persistLocationTrackingFlags,
              syncLocationTracking,
            } = require("../../utils/locationTracker");
            persistLocationTrackingFlags();
            syncLocationTracking();
          } catch (e) {
            // ignore
          }
        } else if (notCheckedIn) {
          ATTENDANCE.user_allow_location = 0;
          try {
            const {
              persistLocationTrackingFlags,
              syncLocationTracking,
            } = require("../../utils/locationTracker");
            persistLocationTrackingFlags();
            syncLocationTracking();
          } catch (e) {
            // ignore
          }
        }
        if (__DEV__) {
          console.warn("[location.track] error:", error?.message || error);
          if (error?.response?.data) {
            console.warn(
              "[location.track] error response:",
              JSON.stringify(error.response.data, null, 2),
            );
          }
        }
        await notifyLocationSendResult({
          success: false,
          message: msg || error?.message || "Location update failed.",
        });
        return { success: false, dummy: true };
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

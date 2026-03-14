export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH_TOKEN: '/auth/refresh',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  CUSTOMER: {
    CREATE: '/customer',
    CREATE_WITH_LOAN: '/customer/with-loan',
    LIST: '/customer',
    SEARCH: '/customer/search',
    DETAILS: (id) => `/customer/${id}`,
    UPDATE: (id) => `/customer/${id}`,
    DELETE: (id) => `/customer/${id}`,
  },
  APP: {
    VERSION: '/appversion',
  },
  COLLECTION: {
    LIST: '/collection',
    UPDATE_AMOUNT: (id) => `/collection/payment/${id}`,
    HISTORY: '/collection/history',
  },
  LOAN: {
    LIST: '/loan',
    NIP: '/loan/nip',
    GIVEN_UPDATE: (id) => `/loan/given/${id}`,
    TYPES: '/loan-type/active/list',
    DETAILS: (id) => `/loan/details/${id}`,
  },
  EXPENSE_CATEGORY: {
    ACTIVE_LIST: '/expense-category/active/list',
  },
  EXPENSE: {
    CREATE: '/expense',
    LIST: '/expense',
  },
};

export default ENDPOINTS;

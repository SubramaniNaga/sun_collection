export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH_TOKEN: '/auth/refresh',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
    CHANGE_DEVICE: '/auth/change-device',
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
    /** Day-end closing summary (adjust path if your backend uses a different route). */
    CLOSING_ACCOUNT: '/collection/closing-account',
  },
  LOAN: {
    LIST: '/loan',
    NIP: '/loan/nip',
    NIP_COLLECTION: '/nip-collection',
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
    DELETE: (id) => `/expense/${id}`,
  },
  UPFRONT_CASH: {
    LIST: '/frontcash',
    OPENING_BALANCE: '/frontcash/openingbalance',
    CLOSE_ACCOUNT: '/frontcash/openingbalance/closeaccount',
  },
  DASHBOARD: {
    TODAY: '/frontcash/dashboard/today',
  },
};

export default ENDPOINTS;

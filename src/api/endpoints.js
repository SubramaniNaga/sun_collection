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
    DETAILS: (id) => `/customer/${id}`,
    UPDATE: (id) => `/customer/${id}`,
    DELETE: (id) => `/customer/${id}`,
  },
  APP: {
    VERSION: '/appversion',
  },
  COLLECTION: {
    LIST: '/collection',
    UPDATE_AMOUNT: (id) => `/collection/amount/${id}`,
  },
  LOAN: {
    LIST: '/loan',
    NIP: '/loan/nip',
  },
};

export default ENDPOINTS;

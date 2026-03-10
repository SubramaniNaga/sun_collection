export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH_TOKEN: '/auth/refresh',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  USER: {
    PROFILE: '/user/profile',
    UPDATE_PROFILE: '/user/profile',
    DELETE_ACCOUNT: '/user/account',
    CHANGE_PASSWORD: '/user/change-password',
  },
  PRODUCTS: {
    LIST: '/products',
    DETAILS: (id) => `/products/${id}`,
    CREATE: '/products',
    UPDATE: (id) => `/products/${id}`,
    DELETE: (id) => `/products/${id}`,
  },
  CATEGORIES: {
    LIST: '/categories',
    DETAILS: (id) => `/categories/${id}`,
  },
  ORDERS: {
    LIST: '/orders',
    DETAILS: (id) => `/orders/${id}`,
    CREATE: '/orders',
    UPDATE_STATUS: (id) => `/orders/${id}/status`,
  },
  SEARCH: {
    PRODUCTS: '/search/products',
    GLOBAL: '/search',
  },
  UPLOAD: {
    IMAGE: '/upload/image',
    DOCUMENT: '/upload/document',
  },
  NOTIFICATIONS: {
    LIST: '/notifications',
    MARK_READ: (id) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/read-all',
  },
  COLLECTION: {
    LIST: '/collection/list',
  },
  APP: {
    VERSION: '/appversion',
  },
  CUSTOMER: {
    CREATE: '/customer',
    CREATE_WITH_LOAN: '/customer/with-loan',
    LIST: '/customer',
    DETAILS: (id) => `/customer/${id}`,
    UPDATE: (id) => `/customer/${id}`,
    DELETE: (id) => `/customer/${id}`,
  },
};

export default ENDPOINTS;

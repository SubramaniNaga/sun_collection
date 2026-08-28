export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    REFRESH_TOKEN: "/auth/refresh",
    LOGOUT: "/auth/logout",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    CHANGE_PASSWORD: "/auth/change-password",
    CHANGE_DEVICE: "/auth/change-device",
  },
  CUSTOMER: {
    CREATE: "/customer",
    CREATE_WITH_LOAN: "/customer/with-loan",
    LIST: "/customer",
    SEARCH: "/customer/search",
    DETAILS: (id) => `/customer/${id}`,
    UPDATE: (id) => `/customer/${id}`,
    DELETE: (id) => `/customer/${id}`,
  },
  APP: {
    VERSION: "/appversion",
  },
  COLLECTION: {
    LIST: "/collection",
    REGISTERED_DAY: "/collection/registered-day",
    UNPAID_LIST: "/collection/list/unpaid",
    PAID_LIST: "/collection/list/paid",
    DELAY_LIST: "/collection/list/delay",
    DELAY_REMARKS_SUBMIT: "/collection/delay-remarks/submit",
    UPDATE_AMOUNT: (id) => `/collection/payment/${id}`,
    HISTORY: "/collection/history",
    /** Day-end closing summary (adjust path if your backend uses a different route). */
    CLOSING_ACCOUNT: "/collection/closing-account",
  },
  LOAN: {
    LIST: "/loan/mobile",
    //LIST: "/loan",
    NIP: "/loan/nip",
    NIP_COLLECTION: "/nip-collection",
    GIVEN_UPDATE: (id) => `/loan/given/${id}`,
    TYPES: "/loan-type/active/list",
    DETAILS: (id) => `/loan/details/${id}`,
    RENEWAL: "/loan/renewal",
  },
  EXPENSE_CATEGORY: {
    ACTIVE_LIST: "/expense-category/active/list",
  },
  EXPENSE: {
    CREATE: "/expense",
    LIST: "/expense",
    DELETE: (id) => `/expense/${id}`,
  },
  BRANCH_USERS: {
    LIST: "/branch-users",
  },
  UPFRONT_CASH: {
    CREATE: "/frontcash",
    LIST: "/frontcash",
    OPENING_BALANCE: "/frontcash/openingbalance",
    CLOSE_ACCOUNT: "/frontcash/openingbalance/closeaccount",
  },
  DASHBOARD: {
    TODAY: "/frontcash/dashboard/today",
  },
  CITY: {
    ACTIVE_LIST: "/city/active/list",
    CREATE: "/city",
  },
  COMPANY_VARAVU: {
    CREATE: "/company-varavu/create",
  },
  ATTENDANCE: {
    MARK: "/attendance",
  },
  LOCATION: {
    TRACK: "/attendance/location-tracking",
    /** Decline nearby collection prompt (adjust if backend uses another route). */
    PROXIMITY_DECLINE: "/attendance/delay-proximity/decline",
  },
};
export default ENDPOINTS;

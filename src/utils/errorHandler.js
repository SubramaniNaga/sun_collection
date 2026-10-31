// Centralized API Error Handling System

export const ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

export const ERROR_MESSAGES = {
  // Single offline / network-failure copy (match translations.errors.networkError)
  [ERROR_TYPES.NETWORK_ERROR]:
    'Network error. Please check your connection.',
  [ERROR_TYPES.SERVER_ERROR]: 'Something went wrong on the server. Please try again later.',
  [ERROR_TYPES.VALIDATION_ERROR]: 'Please check the details and try again.',
  [ERROR_TYPES.AUTHENTICATION_ERROR]: 'Your session has expired. Please login again.',
  [ERROR_TYPES.AUTHORIZATION_ERROR]: 'You don\'t have permission to do this.',
  [ERROR_TYPES.NOT_FOUND_ERROR]: 'The requested details were not found.',
  [ERROR_TYPES.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
  [ERROR_TYPES.UNKNOWN_ERROR]: 'Something went wrong. Please try again.',
  CONFLICT: 'This record already exists or conflicts with current data.',
  TOO_MANY_REQUESTS: 'Too many requests. Please wait and try again.',
  SERVER_UNAVAILABLE: 'Server is temporarily unavailable. Please try again later.',
};

const GENERIC_SERVER_MESSAGES = new Set([
  'error',
  'bad request',
  'unauthorized',
  'forbidden',
  'not found',
  'conflict',
  'internal server error',
  'server error',
  'server error occurred. please try again later.',
  'request failed',
  'something went wrong',
  'something went wrong. please try again.',
]);

/** True when the API sentence is worth showing instead of the status message. */
export function isSpecificServerMessage(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;
  return !GENERIC_SERVER_MESSAGES.has(text);
}

function serverText(data) {
  const message = typeof data?.message === 'string' ? data.message.trim() : '';
  return isSpecificServerMessage(message) ? message : '';
}

export class APIError extends Error {
  constructor(message, type, statusCode, details = null) {
    super(message);
    this.name = 'APIError';
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const ErrorHandler = {
  /**
   * Analyze error and return standardized error object
   */
  analyzeError: (error) => {
    if (error instanceof APIError) {
      return error;
    }

    // Timeout errors — must be checked BEFORE the network branch, because a
    // timed-out request also has no `error.response`. React Native XHR reports
    // this as message "Network Error" with request._response === "timeout".
    const xhrBody = error?.request?._response;
    const isTimeout =
      error.code === 'ECONNABORTED' ||
      /timeout/i.test(String(error?.message || '')) ||
      String(xhrBody || '').trim().toLowerCase() === 'timeout';
    if (isTimeout) {
      return new APIError(
        ERROR_MESSAGES.TIMEOUT_ERROR,
        ERROR_TYPES.TIMEOUT_ERROR,
        null,
        error
      );
    }

    // Cancelled requests — not a connectivity failure
    if (
      error.code === 'ERR_CANCELED' ||
      error.name === 'CanceledError' ||
      String(error.message || '').toLowerCase() === 'canceled'
    ) {
      return new APIError(
        error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
        ERROR_TYPES.UNKNOWN_ERROR,
        null,
        error
      );
    }

    // Network errors — no response was received (DNS, refused, reset, CORS,
    // unreachable host, Wi‑Fi/data off). Axios 1.x: ERR_NETWORK; RN XHR often
    // only "Network Error". Any other request-without-response is treated the same.
    const NETWORK_CODES = [
      'ERR_NETWORK',
      'NETWORK_ERROR',
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'EAI_AGAIN',
      'EHOSTUNREACH',
      'ENETUNREACH',
    ];
    const msg = String(error.message || '');
    const looksLikeNetwork =
      NETWORK_CODES.includes(error.code) ||
      msg === 'Network Error' ||
      /network error|failed to fetch|network request failed/i.test(msg);
    if (!error.response && (looksLikeNetwork || error.request != null)) {
      return new APIError(
        ERROR_MESSAGES.NETWORK_ERROR,
        ERROR_TYPES.NETWORK_ERROR,
        null,
        error
      );
    }

    // Axios errors with response
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
        case 422:
          return new APIError(
            serverText(data) || ERROR_MESSAGES.VALIDATION_ERROR,
            ERROR_TYPES.VALIDATION_ERROR,
            status,
            data
          );

        case 401:
          return new APIError(
            ERROR_MESSAGES.AUTHENTICATION_ERROR,
            ERROR_TYPES.AUTHENTICATION_ERROR,
            status,
            data
          );

        case 403:
          return new APIError(
            ERROR_MESSAGES.AUTHORIZATION_ERROR,
            ERROR_TYPES.AUTHORIZATION_ERROR,
            status,
            data
          );

        case 404:
          return new APIError(
            ERROR_MESSAGES.NOT_FOUND_ERROR,
            ERROR_TYPES.NOT_FOUND_ERROR,
            status,
            data
          );

        case 409:
          return new APIError(
            ERROR_MESSAGES.CONFLICT,
            ERROR_TYPES.VALIDATION_ERROR,
            status,
            data
          );

        case 429:
          return new APIError(
            ERROR_MESSAGES.TOO_MANY_REQUESTS,
            ERROR_TYPES.UNKNOWN_ERROR,
            status,
            data
          );

        case 500:
          return new APIError(
            ERROR_MESSAGES.SERVER_ERROR,
            ERROR_TYPES.SERVER_ERROR,
            status,
            data
          );

        case 502:
        case 503:
        case 504:
          return new APIError(
            ERROR_MESSAGES.SERVER_UNAVAILABLE,
            ERROR_TYPES.SERVER_ERROR,
            status,
            data
          );

        default:
          return new APIError(
            serverText(data) || ERROR_MESSAGES.UNKNOWN_ERROR,
            ERROR_TYPES.UNKNOWN_ERROR,
            status,
            data
          );
      }
    }

    // Unknown errors
    return new APIError(
      error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
      ERROR_TYPES.UNKNOWN_ERROR,
      null,
      error
    );
  },

  /**
   * Get user-friendly error message
   */
  getErrorMessage: (error) => {
    const analyzedError = ErrorHandler.analyzeError(error);
    return analyzedError.message;
  },

  /**
   * Get error type
   */
  getErrorType: (error) => {
    const analyzedError = ErrorHandler.analyzeError(error);
    return analyzedError.type;
  },

  /**
   * Check if error is authentication related
   */
  isAuthError: (error) => {
    const type = ErrorHandler.getErrorType(error);
    return type === ERROR_TYPES.AUTHENTICATION_ERROR || type === ERROR_TYPES.AUTHORIZATION_ERROR;
  },

  /**
   * Check if error is network related
   */
  isNetworkError: (error) => {
    const type = ErrorHandler.getErrorType(error);
    // Offline / unreachable + timeout → same user-facing network treatment
    return type === ERROR_TYPES.NETWORK_ERROR || type === ERROR_TYPES.TIMEOUT_ERROR;
  },

  /** Message used for all connectivity failures (match translations.errors.networkError). */
  getNetworkErrorMessage: () => ERROR_MESSAGES[ERROR_TYPES.NETWORK_ERROR],

  /**
   * Check if error is server related
   */
  isServerError: (error) => {
    const type = ErrorHandler.getErrorType(error);
    return type === ERROR_TYPES.SERVER_ERROR;
  },

  /**
   * Handle error globally (e.g., logging, analytics)
   */
  handleGlobalError: (error, context = {}) => {
    const analyzedError = ErrorHandler.analyzeError(error);
    
    // Log for debugging without triggering LogBox snackbar (console.error shows on-screen toast)
    if (__DEV__) {
      console.warn('API Error:', {
        type: analyzedError.type,
        message: analyzedError.message,
        statusCode: analyzedError.statusCode,
        context,
        timestamp: new Date().toISOString(),
      });
    }

    // Here you could add:
    // - Analytics tracking
    // - Error reporting service (Sentry, etc.)
    // - Custom logging
    
    return analyzedError;
  },

  /**
   * Create custom error
   */
  createError: (message, type = ERROR_TYPES.UNKNOWN_ERROR, statusCode = null, details = null) => {
    return new APIError(message, type, statusCode, details);
  },
};

/**
 * Higher-order function to wrap API calls with error handling
 */
export const withErrorHandling = (apiFunction) => {
  return async (...args) => {
    try {
      const result = await apiFunction(...args);
      return { success: true, data: result, error: null };
    } catch (error) {
      const handledError = ErrorHandler.handleGlobalError(error, {
        functionName: apiFunction.name,
        args: args.map(arg => typeof arg === 'object' ? '[Object]' : arg),
      });
      
      return { success: false, data: null, error: handledError };
    }
  };
};

/**
 * React hook for error handling
 */
export const useErrorHandler = () => {
  const handleError = (error, context = {}) => {
    return ErrorHandler.handleGlobalError(error, context);
  };

  const getErrorMessage = (error) => {
    return ErrorHandler.getErrorMessage(error);
  };

  const isAuthError = (error) => {
    return ErrorHandler.isAuthError(error);
  };

  const isNetworkError = (error) => {
    return ErrorHandler.isNetworkError(error);
  };

  return {
    handleError,
    getErrorMessage,
    isAuthError,
    isNetworkError,
    ErrorHandler,
  };
};

export default ErrorHandler;

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
  [ERROR_TYPES.NETWORK_ERROR]: 'No internet connection. Please check your network.',
  [ERROR_TYPES.SERVER_ERROR]: 'Server error occurred. Please try again later.',
  [ERROR_TYPES.VALIDATION_ERROR]: 'Invalid data provided. Please check your input.',
  [ERROR_TYPES.AUTHENTICATION_ERROR]: 'Authentication failed. Please login again.',
  [ERROR_TYPES.AUTHORIZATION_ERROR]: 'You don\'t have permission to perform this action.',
  [ERROR_TYPES.NOT_FOUND_ERROR]: 'The requested resource was not found.',
  [ERROR_TYPES.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
  [ERROR_TYPES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
};

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

    // Network errors
    if (!error.response && error.code === 'NETWORK_ERROR') {
      return new APIError(
        ERROR_MESSAGES.NETWORK_ERROR,
        ERROR_TYPES.NETWORK_ERROR,
        null,
        error
      );
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new APIError(
        ERROR_MESSAGES.TIMEOUT_ERROR,
        ERROR_TYPES.TIMEOUT_ERROR,
        null,
        error
      );
    }

    // Axios errors with response
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          return new APIError(
            data?.message || ERROR_MESSAGES.VALIDATION_ERROR,
            ERROR_TYPES.VALIDATION_ERROR,
            status,
            data
          );
        
        case 401:
          return new APIError(
            data?.message || ERROR_MESSAGES.AUTHENTICATION_ERROR,
            ERROR_TYPES.AUTHENTICATION_ERROR,
            status,
            data
          );
        
        case 403:
          return new APIError(
            data?.message || ERROR_MESSAGES.AUTHORIZATION_ERROR,
            ERROR_TYPES.AUTHORIZATION_ERROR,
            status,
            data
          );
        
        case 404:
          return new APIError(
            data?.message || ERROR_MESSAGES.NOT_FOUND_ERROR,
            ERROR_TYPES.NOT_FOUND_ERROR,
            status,
            data
          );
        
        case 500:
        case 502:
        case 503:
        case 504:
          return new APIError(
            data?.message || ERROR_MESSAGES.SERVER_ERROR,
            ERROR_TYPES.SERVER_ERROR,
            status,
            data
          );
        
        default:
          return new APIError(
            data?.message || ERROR_MESSAGES.UNKNOWN_ERROR,
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
    return type === ERROR_TYPES.NETWORK_ERROR || type === ERROR_TYPES.TIMEOUT_ERROR;
  },

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

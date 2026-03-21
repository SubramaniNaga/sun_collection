import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { setLogoutCallback } from '../api/apiClient';
import apiServices from '../api/services/apiServices';

const AuthContext = createContext();

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  error: null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      };
    case 'AUTH_UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'AUTH_INITIALIZE':
      return {
        ...state,
        loading: false,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const initializeAuth = async () => {
    try {
      const authData = await apiServices.auth.getCurrentUser();
      
      if (authData.isAuthenticated) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: authData.user,
            token: authData.token
          }
        });
      } else {
        dispatch({ type: 'AUTH_INITIALIZE' });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      dispatch({ type: 'AUTH_INITIALIZE' });
    }
  };

  const login = async (credentials) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const data = await apiServices.auth.login(credentials);
      
      // Handle language detection and setting from login first
      await handleLanguageFromLogin(credentials, data.user);
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user: data.user, token: data.token },
      });
      
      return data;
    } catch (error) {
      dispatch({
        type: 'AUTH_FAILURE',
        payload: error.message,
      });
      throw error;
    }
  };

  const handleLanguageFromLogin = async (credentials, user) => {
    try {
      // The API service already stores the language preference from the response
      // We just need to ensure it's properly set for the LanguageContext
      
      const apiLanguage = user?.language || user?.lang || credentials.language;
      
      if (apiLanguage && (apiLanguage === 'en' || apiLanguage === 'ta' || apiLanguage === 'tn')) {
        // Normalize 'tn' to 'ta' for Tamil
        const normalizedLanguage = apiLanguage === 'tn' ? 'ta' : apiLanguage;
        
        // Store login language preference for LanguageContext priority
        await AsyncStorage.setItem('login_language', normalizedLanguage);
        
        // Ensure the main language storage is updated
        await AsyncStorage.setItem('@app_language', normalizedLanguage);
        
        console.log('🌐 Language set from login API:', normalizedLanguage);
        return normalizedLanguage;
      }
      
    } catch (error) {
      console.error('Error handling language from login:', error);
    }
  };

  const logout = async () => {
    try {
      await apiServices.auth.logout();
      dispatch({ type: 'AUTH_LOGOUT' });
    } catch (error) {
      console.error('Logout error:', error);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  const forceLogout = useCallback(async () => {
    try {
      await apiServices.auth.logout();
      dispatch({ type: 'AUTH_LOGOUT' });
    } catch (error) {
      console.error('Force logout error:', error);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);

  const updateUser = (userData) => {
    dispatch({
      type: 'AUTH_UPDATE_USER',
      payload: userData,
    });
  };

  const clearError = () => {
    dispatch({ type: 'AUTH_CLEAR_ERROR' });
  };

  useEffect(() => {
    initializeAuth();
    
    // Register logout callback with apiClient so it can trigger logout on 401/403
    setLogoutCallback(async () => {
      console.log('🔄 Logout callback triggered from apiClient');
      await forceLogout();
    });
    
    // Cleanup: unregister callback on unmount
    return () => {
      setLogoutCallback(null);
    };
  }, [forceLogout]);

  const value = {
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    error: state.error,
    login,
    logout,
    forceLogout,
    updateUser,
    clearError,
    initializeAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

import { useCallback, useEffect, useState } from 'react';
import apiServices from '../api/services/apiServices';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const initializeAuth = useCallback(async () => {
    try {
      setLoading(true);
      const authData = await apiServices.auth.getCurrentUser();

      if (authData.isAuthenticated) {
        setUser(authData.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      setError(err);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      setError(null);
      const response = await apiServices.auth.login(credentials);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (err) {
      setError(err);
      setUser(null);
      setIsAuthenticated(false);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiServices.auth.logout();
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(prevUser => ({ ...prevUser, ...userData }));
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const response = await apiServices.auth.refreshToken();
      return response;
    } catch (err) {
      setUser(null);
      setIsAuthenticated(false);
      setError(err);
      throw err;
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    updateUser,
    refreshToken,
    initializeAuth,
  };
};

export default useAuth;

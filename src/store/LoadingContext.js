import { createContext, useCallback, useContext, useState } from 'react';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
  const [globalLoading, setGlobalLoading] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  const startLoading = useCallback(() => {
    setRequestCount(prev => prev + 1);
    setGlobalLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setRequestCount(prev => Math.max(0, prev - 1));
    if (requestCount <= 1) {
      setGlobalLoading(false);
    }
  }, [requestCount]);

  const isLoading = useCallback(() => {
    return globalLoading;
  }, [globalLoading]);

  const getLoadingCount = useCallback(() => {
    return requestCount;
  }, [requestCount]);

  const clearAllLoading = useCallback(() => {
    setRequestCount(0);
    setGlobalLoading(false);
  }, []);

  const value = {
    globalLoading,
    requestCount,
    startLoading,
    stopLoading,
    isLoading,
    getLoadingCount,
    clearAllLoading,
  };

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export default LoadingContext;

import { createContext, useCallback, useContext, useState } from 'react';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
  const [requestCount, setRequestCount] = useState(0);
  /** Derived from count so parallel start/stop never leaves the overlay stuck (stale closure bug). */
  const globalLoading = requestCount > 0;

  const startLoading = useCallback(() => {
    setRequestCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setRequestCount((prev) => Math.max(0, prev - 1));
  }, []);

  const isLoading = useCallback(() => {
    return requestCount > 0;
  }, [requestCount]);

  const getLoadingCount = useCallback(() => {
    return requestCount;
  }, [requestCount]);

  const clearAllLoading = useCallback(() => {
    setRequestCount(0);
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

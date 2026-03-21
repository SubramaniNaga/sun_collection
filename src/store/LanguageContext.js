import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import translations from '../translations/translations';

const LanguageContext = createContext();

const LANGUAGE_STORAGE_KEY = '@app_language';
const DEFAULT_LANGUAGE = 'en';

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [loading, setLoading] = useState(true);
  const [updateKey, setUpdateKey] = useState(0); // Force re-render key

  // Load saved language preference on mount
  useEffect(() => {
    loadLanguage();
  }, []);

  // Listen for language changes from other components
  useEffect(() => {
    const checkForLanguageUpdates = async () => {
      try {
        const currentLanguage = await AsyncStorage.getItem('@app_language');
        if (currentLanguage && currentLanguage !== language) {
          setLanguage(currentLanguage);
          setUpdateKey(prev => prev + 1); // Force re-render
          console.log('🌐 Language updated:', currentLanguage);
        }
      } catch (error) {
        console.error('Error checking language updates:', error);
      }
    };

    // Check for language updates when the app comes to foreground
    const interval = setInterval(checkForLanguageUpdates, 2000);
    return () => clearInterval(interval);
  }, [language]);

  const loadLanguage = async () => {
    try {
      // Priority: Login language > Manual choice > Default (English)
      
      // 1. Check for login language (highest priority)
      const loginLanguage = await AsyncStorage.getItem('login_language');
      if (loginLanguage && (loginLanguage === 'en' || loginLanguage === 'ta')) {
        setLanguage(loginLanguage);
        console.log('🌐 Language loaded from login preference:', loginLanguage);
        return;
      }
      
      // 2. Check for manually set language preference
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ta')) {
        setLanguage(savedLanguage);
        console.log('🌐 Language loaded from manual preference:', savedLanguage);
        return;
      }
      
      // 3. Default to English
      setLanguage(DEFAULT_LANGUAGE);
      console.log('🌐 Default language set: English');
    } catch (error) {
      console.error('Error loading language:', error);
      setLanguage(DEFAULT_LANGUAGE);
    } finally {
      setLoading(false);
    }
  };

  const changeLanguage = async (newLanguage) => {
    try {
      if (newLanguage === 'en' || newLanguage === 'ta') {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
        setLanguage(newLanguage);
        
        // Also update user data to persist manual choice
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.language = newLanguage;
          await AsyncStorage.setItem('userData', JSON.stringify(parsedUser));
        }
        
        console.log('🌐 Language manually changed to:', newLanguage);
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key "${key}" not found for language "${language}"`);
        return key; // Return key if translation not found
      }
    }

    // Replace placeholders like {min}, {max} with actual values
    if (typeof value === 'string' && params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }

    return value || key;
  };

  const value = {
    language,
    changeLanguage,
    t,
    loading,
    updateKey, // Include updateKey to force re-renders
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;

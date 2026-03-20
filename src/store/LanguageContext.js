import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import translations from '../translations/translations';

const LanguageContext = createContext();

const LANGUAGE_STORAGE_KEY = '@app_language';
const DEFAULT_LANGUAGE = 'en';

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [loading, setLoading] = useState(true);

  // Load saved language preference on mount
  useEffect(() => {
    loadLanguage();
  }, []);

  // Also check for language from login data when app starts
  useEffect(() => {
    checkLanguageFromLoginData();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ta')) {
        setLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkLanguageFromLoginData = async () => {
    try {
      // Check if language is stored in user data from login
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        const loginLanguage = parsedUser.language || parsedUser.lang;
        
        if (loginLanguage && (loginLanguage === 'en' || loginLanguage === 'ta' || loginLanguage === 'tn')) {
          // Normalize 'tn' to 'ta' for Tamil
          const normalizedLanguage = loginLanguage === 'tn' ? 'ta' : loginLanguage;
          
          // Only change if different from current language
          if (language !== normalizedLanguage) {
            await changeLanguage(normalizedLanguage);
            console.log('Language automatically set from login data:', normalizedLanguage);
          }
        }
      }
    } catch (error) {
      console.error('Error checking language from login data:', error);
    }
  };

  const changeLanguage = async (newLanguage) => {
    try {
      if (newLanguage === 'en' || newLanguage === 'ta') {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
        setLanguage(newLanguage);
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

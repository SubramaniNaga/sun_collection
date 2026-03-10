export const validators = {
  email: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  password: (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers,
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
    };
  },

  phone: (phone) => {
    const phoneRegex = /^\+?[\d\s-()]{10,}$/;
    return phoneRegex.test(phone);
  },

  url: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  required: (value) => {
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
  },

  minLength: (value, min) => {
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length >= min;
    }
    return false;
  },

  maxLength: (value, max) => {
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length <= max;
    }
    return false;
  },

  numeric: (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  integer: (value) => {
    return Number.isInteger(Number(value));
  },

  positive: (value) => {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  },

  range: (value, min, max) => {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
  },

  alpha: (value) => {
    return /^[a-zA-Z]+$/.test(value);
  },

  alphaNumeric: (value) => {
    return /^[a-zA-Z0-9]+$/.test(value);
  },

  date: (value) => {
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
  },

  futureDate: (value) => {
    const date = new Date(value);
    const now = new Date();
    return date instanceof Date && !isNaN(date) && date > now;
  },

  pastDate: (value) => {
    const date = new Date(value);
    const now = new Date();
    return date instanceof Date && !isNaN(date) && date < now;
  },

  match: (value1, value2) => {
    return value1 === value2;
  },

  creditCard: (cardNumber) => {
    const cleaned = cardNumber.replace(/\s/g, '');
    const regex = /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/;
    
    if (!regex.test(cleaned)) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i), 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  },

  ssn: (ssn) => {
    const ssnRegex = /^(?!000|666|9[0-9][0-9])\d{3}-(?!00)\d{2}-(?!0000)\d{4}$/;
    return ssnRegex.test(ssn);
  },

  zipCode: (zipCode) => {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(zipCode);
  },

  username: (username) => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  },

  strongPassword: (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
    };
  },
};

export default validators;

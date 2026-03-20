// Define the currency symbol used across the application.
// Change this to switch the symbol globally (e.g., '$', '€', '£').
export const CURRENCY_SYMBOL = '₹';

/**
 * Formats a number or string into currency format with the global symbol.
 * 
 * @param {number|string} amount - The numeric value or string to format.
 * @param {number} decimalPlaces - The number of decimal places to show (default is 0).
 * @returns {string} The formatted currency string (e.g., ₹ 20,000).
 */
export const formatCurrency = (amount, decimalPlaces = 0) => {
  if (amount === null || amount === undefined || amount === '') {
    return `${CURRENCY_SYMBOL} 0`;
  }

  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    return `${CURRENCY_SYMBOL} 0`;
  }

  // Format the number without forcing a specific currency style
  // so we can prepend our custom CURRENCY_SYMBOL.
  // We use 'en-IN' for the Indian number system grouping (lakhs/crores).
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });

  const formattedValue = formatter.format(numericAmount);

  return `${CURRENCY_SYMBOL} ${formattedValue}`;
};

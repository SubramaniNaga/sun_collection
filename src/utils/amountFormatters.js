// Define the currency symbol used across the application.
// Change this to switch the symbol globally (e.g., '$', '€', '£').
export const CURRENCY_SYMBOL = '₹';

const parseAmount = (amount) => {
  if (amount === null || amount === undefined || amount === '') {
    return null;
  }

  const numericAmount = Number(String(amount).replace(/,/g, '').trim());
  if (Number.isNaN(numericAmount)) {
    return null;
  }

  return numericAmount;
};

/**
 * Amount for TextInputs: strips trailing .00 so "100.00" becomes "100".
 * Keeps a real fractional part up to 2 digits without trailing zeros.
 */
export const formatAmountPlain = (amount) => {
  const n = parseAmount(amount);
  if (n === null) {
    return '';
  }

  if (Math.abs(n - Math.round(n)) < 1e-9) {
    return String(Math.round(n));
  }

  return String(parseFloat(n.toFixed(2)));
};

/**
 * Formats a number or string into currency format with the global symbol.
 * Whole rupees omit decimals (100.00 → ₹ 100). Real paise keep up to 2 digits.
 *
 * @param {number|string} amount - The numeric value or string to format.
 * @param {number} [decimalPlaces] - Force this many fraction digits. Omit to hide .00.
 * @returns {string} The formatted currency string (e.g., ₹ 20,000).
 */
export const formatCurrency = (amount, decimalPlaces) => {
  const numericAmount = parseAmount(amount);

  if (numericAmount === null) {
    return `${CURRENCY_SYMBOL} 0`;
  }

  const isWhole = Math.abs(numericAmount - Math.round(numericAmount)) < 1e-9;
  const minFrac = decimalPlaces === undefined ? 0 : decimalPlaces;
  const maxFrac = decimalPlaces === undefined ? (isWhole ? 0 : 2) : decimalPlaces;

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  });

  const formattedValue = formatter.format(numericAmount);

  return `${CURRENCY_SYMBOL} ${formattedValue}`;
};

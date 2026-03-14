/**
 * Centralized date formatting utilities.
 * Display format: dd-MM-yyyy (e.g. 13-03-2026)
 * API format: YYYY-MM-DD (e.g. 2026-03-13)
 */

const FALLBACK = '—';

/**
 * Format a date for display in the app (dd-MM-yyyy).
 * @param {Date|string|number|null|undefined} date - Date to format
 * @returns {string} Formatted date string or fallback
 */
export function formatDisplayDate(date) {
  if (date == null || date === '') return FALLBACK;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return FALLBACK;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format a date with time for display (dd-MM-yyyy, HH:mm).
 * @param {Date|string|number|null|undefined} date - Date to format
 * @returns {string} Formatted date-time string or fallback
 */
export function formatDateTimeDisplay(date) {
  if (date == null || date === '') return FALLBACK;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return FALLBACK;
  const datePart = formatDisplayDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${datePart}, ${hours}:${minutes}`;
}

/**
 * Format a date for API requests (YYYY-MM-DD).
 * @param {Date|string|number|null|undefined} date - Date to format
 * @returns {string} YYYY-MM-DD or empty string if invalid
 */
export function formatDateForAPI(date) {
  if (date == null || date === '') return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current date as YYYY-MM-DD (for API or comparison).
 * @returns {string}
 */
export function getCurrentDateString() {
  return formatDateForAPI(new Date());
}

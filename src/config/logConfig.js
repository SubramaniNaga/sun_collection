/**
 * Debug-only console switch.
 * Release builds never print, even when this is true.
 * true  = print console.log / info / debug / warn / error in debug
 * false = hide them in debug as well
 */
export const ENABLE_APP_LOGS = true;

export function isAppLoggingEnabled() {
  const isDebug = typeof __DEV__ !== 'undefined' && __DEV__;
  if (!isDebug) return false;
  return ENABLE_APP_LOGS === true;
}

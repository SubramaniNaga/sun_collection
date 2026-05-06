import { useEffect, useState } from 'react';

/** Default delay (ms) for search / filter debouncing across the app */
export const DEBOUNCE_MS_DEFAULT = 400;

/**
 * Returns a value that updates only after `delayMs` has passed without `value` changing.
 * Use for debouncing search inputs before API calls or expensive filtering.
 */
export function useDebouncedValue(value, delayMs = DEBOUNCE_MS_DEFAULT) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

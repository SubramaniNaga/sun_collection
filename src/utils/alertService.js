/**
 * Centralized alert service.
 * Use showAlert() / showSuccess() / showError() / showWarning() from anywhere.
 * API error messages are shown when passed as message or via getApiErrorMessage().
 */

let _show = null;

export const ALERT_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
};

/**
 * Set the alert renderer (called by AlertProvider on mount).
 * @param {(config: AlertConfig) => void} fn
 */
export function setAlertRenderer(fn) {
  _show = fn;
}

/**
 * Extract message from API error for display in alert.
 * @param {*} error - Axios error or Error object
 * @param {string} [fallback] - Fallback message if none found
 * @returns {string}
 */
export function getApiErrorMessage(
  error,
  fallback = "Something went wrong. Please try again.",
) {
  if (!error) return fallback;
  const msg =
    error?.response?.data?.message ??
    error?.response?.data?.error ??
    (typeof error?.response?.data === "string" ? error.response.data : null) ??
    error?.message;
  return msg && String(msg).trim() ? String(msg) : fallback;
}

/**
 * Show a styled alert.
 * @param {Object} config
 * @param {'success'|'error'|'warning'|'info'} config.type
 * @param {string} config.title
 * @param {string} config.message - Shown in alert body (use getApiErrorMessage(error) for API failures)
 * @param {Array<{text: string, onPress?: () => void, style?: 'cancel'|'default'}>} [config.buttons]
 */
export function showAlert(config) {
  if (typeof config === "string") {
    config = { type: ALERT_TYPES.INFO, title: "", message: config };
  } else if (!config || typeof config !== "object") {
    return;
  }
  const { type = ALERT_TYPES.INFO, title = "", message = "", buttons } = config;
  if (_show) {
    _show({
      type:
        type === "success"
          ? ALERT_TYPES.SUCCESS
          : type === "error"
            ? ALERT_TYPES.ERROR
            : type === "warning"
              ? ALERT_TYPES.WARNING
              : ALERT_TYPES.INFO,
      title: String(title),
      message: message != null ? String(message) : "",
      buttons: Array.isArray(buttons) ? buttons : [{ text: "OK" }],
    });
  } else {
    // Fallback to React Native Alert if provider not mounted (e.g. in tests)
    const { Alert } = require("react-native");
    Alert.alert(
      title ||
        (type === "error"
          ? "Error"
          : type === "success"
            ? "Success"
            : type === "warning"
              ? "Warning"
              : "Notice"),
      message,
      buttons,
    );
  }
}

/**
 * Show success alert (green).
 */
export function showSuccess(title, message, buttons) {
  showAlert({ type: ALERT_TYPES.SUCCESS, title, message, buttons });
}

/**
 * Show error alert (red). Use getApiErrorMessage(error) for message when API fails.
 */
export function showError(title, message, buttons) {
  showAlert({ type: ALERT_TYPES.ERROR, title, message, buttons });
}

/**
 * Show warning alert (orange).
 */
export function showWarning(title, message, buttons) {
  showAlert({ type: ALERT_TYPES.WARNING, title, message, buttons });
}

/**
 * Show info alert (neutral).
 */
export function showInfo(title, message, buttons) {
  showAlert({ type: ALERT_TYPES.INFO, title, message, buttons });
}

/**
 * Show session expired alert and trigger logout.
 * @param {Function} logoutCallback - Function to call after user dismisses alert
 */
export function showSessionExpiredAlert(logoutCallback) {
  showAlert({
    type: ALERT_TYPES.WARNING,
    title: "Session Expired",
    message: "Your session has expired. Please login again.",
    buttons: [
      {
        text: "OK",
        onPress: async () => {
          if (logoutCallback && typeof logoutCallback === "function") {
            await logoutCallback();
          }
        },
      },
    ],
  });
}

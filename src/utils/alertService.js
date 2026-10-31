/**
 * Centralized alert service.
 * Use showAlert() / showSuccess() / showError() / showWarning() from anywhere.
 * API error messages are shown when passed as message or via getApiErrorMessage().
 */

import translations from "../translations/translations";
import { getCurrentAppLanguage } from "../store/LanguageContext";
import ErrorHandler, {
  ERROR_MESSAGES,
  ERROR_TYPES,
  isSpecificServerMessage,
} from "./errorHandler";

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

/** Localized single copy for offline / network failure (all screens). */
function getLocalizedErrorText(key, englishFallback) {
  const lang = getCurrentAppLanguage();
  return (
    translations?.[lang]?.errors?.[key] ||
    translations?.en?.errors?.[key] ||
    englishFallback
  );
}

function getLocalizedNetworkErrorMessage() {
  return getLocalizedErrorText(
    "networkError",
    ERROR_MESSAGES[ERROR_TYPES.NETWORK_ERROR],
  );
}

function statusCodeOf(error) {
  const code =
    error?.statusCode ??
    error?.response?.status ??
    error?.response?.data?.status ??
    null;
  const numeric = Number(code);
  return Number.isFinite(numeric) ? numeric : null;
}

function serverMessageOf(error) {
  const details =
    error?.details && typeof error.details === "object" ? error.details : null;
  const raw =
    error?.response?.data?.message ??
    error?.response?.data?.error ??
    (typeof error?.response?.data === "string" ? error.response.data : null) ??
    details?.message ??
    details?.error ??
    null;
  const text = raw != null ? String(raw).trim() : "";
  return text;
}

/** Statuses whose alert text comes from the code, not the server sentence. */
const STATUS_MESSAGE_KEYS = {
  401: ["sessionExpired", ERROR_MESSAGES[ERROR_TYPES.AUTHENTICATION_ERROR]],
  403: ["forbidden", ERROR_MESSAGES[ERROR_TYPES.AUTHORIZATION_ERROR]],
  404: ["notFound", ERROR_MESSAGES[ERROR_TYPES.NOT_FOUND_ERROR]],
  409: ["conflict", ERROR_MESSAGES.CONFLICT],
  429: ["tooManyRequests", ERROR_MESSAGES.TOO_MANY_REQUESTS],
  500: ["serverError", ERROR_MESSAGES[ERROR_TYPES.SERVER_ERROR]],
  502: ["serverUnavailable", ERROR_MESSAGES.SERVER_UNAVAILABLE],
  503: ["serverUnavailable", ERROR_MESSAGES.SERVER_UNAVAILABLE],
  504: ["serverUnavailable", ERROR_MESSAGES.SERVER_UNAVAILABLE],
};

/**
 * True for no-network / unreachable host (not HTTP 4xx/5xx).
 * Timeout is treated the same so users always see one network message.
 */
function looksLikeNetworkMessage(msg) {
  return (
    msg === "Network Error" ||
    /network error|failed to fetch|network request failed|no internet|check your connection|turn on mobile data|timed?\s*out/i.test(
      msg,
    )
  );
}

function isConnectivityFailure(error) {
  if (!error) return false;
  if (
    error.type === ERROR_TYPES.NETWORK_ERROR ||
    error.type === ERROR_TYPES.TIMEOUT_ERROR
  ) {
    return true;
  }
  // HTTP responses (4xx/5xx) are not "no internet"
  if (error.response || error.statusCode) {
    // Except: APIError network type already handled above; statusCode alone on
    // non-network APIError means server/client HTTP — not connectivity.
    if (error.statusCode != null && error.type && error.type !== ERROR_TYPES.NETWORK_ERROR) {
      return false;
    }
    if (error.response) return false;
  }

  const code = String(error.code || error.details?.code || "");
  const msg = String(error.message || "");
  if (
    [
      "ERR_NETWORK",
      "NETWORK_ERROR",
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "ECONNABORTED",
    ].includes(code)
  ) {
    return true;
  }
  if (looksLikeNetworkMessage(msg)) {
    return true;
  }
  // Unwrap original axios error stored on APIError.details
  const nested = error.details;
  if (nested && nested !== error && typeof nested === "object") {
    if (!nested.response && looksLikeNetworkMessage(String(nested.message || ""))) {
      return true;
    }
    if (
      [
        "ERR_NETWORK",
        "NETWORK_ERROR",
        "ECONNABORTED",
      ].includes(String(nested.code || ""))
    ) {
      return true;
    }
  }
  try {
    return ErrorHandler.isNetworkError(error);
  } catch {
    return false;
  }
}

/**
 * Extract message from API error for display in alert.
 * Network / offline failures always use errors.networkError (same text everywhere).
 * @param {*} error - Axios error or Error object
 * @param {string} [fallback] - Fallback message if none found
 * @returns {string}
 */
export function getApiErrorMessage(
  error,
  fallback = "Something went wrong. Please try again.",
) {
  if (!error) return fallback;

  if (isConnectivityFailure(error)) {
    return getLocalizedNetworkErrorMessage();
  }

  const status = statusCodeOf(error);
  const serverMessage = serverMessageOf(error);
  const specificServerMessage = isSpecificServerMessage(serverMessage)
    ? serverMessage
    : "";

  if ((status === 400 || status === 422) && specificServerMessage) {
    return specificServerMessage;
  }
  if (status === 400 || status === 422) {
    return getLocalizedErrorText(
      "invalidInput",
      ERROR_MESSAGES[ERROR_TYPES.VALIDATION_ERROR],
    );
  }

  const statusMessage = STATUS_MESSAGE_KEYS[status];
  if (statusMessage) {
    return getLocalizedErrorText(statusMessage[0], statusMessage[1]);
  }

  if (specificServerMessage) return specificServerMessage;
  if (error?.message && isSpecificServerMessage(error.message)) {
    return String(error.message).trim();
  }
  return fallback || getLocalizedErrorText("somethingWentWrong", "Something went wrong. Please try again.");
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
 * Error alert with OK (dismiss) + Retry.
 * @param {string} title
 * @param {string} message
 * @param {() => void} onRetry
 * @param {{ ok?: string, retry?: string }} [labels]
 */
export function showErrorWithRetry(title, message, onRetry, labels = {}) {
  showError(title, message, [
    { text: labels.ok || "OK", style: "cancel" },
    {
      text: labels.retry || "Retry",
      onPress: () => {
        if (typeof onRetry === "function") onRetry();
      },
    },
  ]);
}

/**
 * Throw when API body says success: false (HTTP may still be 2xx).
 * @param {*} response
 * @param {string} [fallbackMessage]
 */
export function throwIfApiFailed(response, fallbackMessage = "Request failed") {
  if (
    response &&
    typeof response === "object" &&
    response.success === false
  ) {
    const err = new Error(
      String(response.message || response.error || fallbackMessage).trim() ||
        fallbackMessage,
    );
    err.response = {
      data: response,
      status: response.status ?? response.statusCode,
    };
    throw err;
  }
  return response;
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

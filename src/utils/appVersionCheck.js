import Constants from 'expo-constants';
import { apiServices } from '../api/services/apiServices';
import { APP_VERSION } from '../constants/appVersion';

/** Set true to show store-update bottom sheet when app version is behind API. */
export const ENABLE_APP_UPDATE_PROMPT = false;

export function compareVersions(version1, version2) {
  if (!version1 || !version2) {
    return 0;
  }

  const v1parts = version1.toString().split('.').map(Number);
  const v2parts = version2.toString().split('.').map(Number);

  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;

    if (v1part < v2part) return -1;
    if (v1part > v2part) return 1;
  }

  return 0;
}

function unwrapVersionPayload(raw) {
  if (raw && typeof raw === 'object' && raw.response != null && typeof raw.response === 'object') {
    return raw.response;
  }
  return raw;
}

export async function evaluateAppVersion() {
  try {
    const raw = await apiServices.app.getVersion();
    const versionData = unwrapVersionPayload(raw) || {};

    if (versionData.isMaintaince) {
      return {
        kind: 'maintenance',
        message: versionData.maitainnaceMessage || '',
        payload: raw,
      };
    }

    const currentVersion = APP_VERSION;
    const platform = Constants.platform?.ios ? 'ios' : 'android';
    const apiVersion = platform === 'ios' ? versionData.iOSVersion : versionData.androidVersion;
    const forceUpdate = platform === 'ios' ? versionData.iOSForceUpdate : versionData.androidForceUpdate;

    if (compareVersions(currentVersion, apiVersion) < 0) {
      if (!ENABLE_APP_UPDATE_PROMPT) {
        return { kind: 'ok', payload: raw };
      }
      const storeUrl =
        platform === 'ios'
          ? 'https://apps.apple.com'
          : 'https://play.google.com/store/apps';

      return {
        kind: 'update',
        currentVersion,
        latestVersion: String(apiVersion),
        forceUpdate: Boolean(forceUpdate),
        storeUrl,
        payload: raw,
      };
    }

    return { kind: 'ok', payload: raw };
  } catch (e) {
    if (__DEV__) console.warn('App version check error:', e);
    return { kind: 'error' };
  }
}

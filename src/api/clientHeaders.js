import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { APP_VERSION } from '../constants/appVersion';
import { getDeviceId } from '../utils/deviceId';

const IP_LOOKUP_URL = 'https://api.ipify.org?format=json';
const IP_LOOKUP_TIMEOUT_MS = 4000;
const IP_TTL_MS = 2 * 60 * 1000;

let cachedPublicIp = '';
let cachedPublicIpAt = 0;
let ipLookupPromise = null;

async function lookupPublicIp() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IP_LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(IP_LOOKUP_URL, { signal: controller.signal });
    const data = await response.json();
    const ip = typeof data?.ip === 'string' ? data.ip.trim() : '';
    if (ip) {
      cachedPublicIp = ip;
      cachedPublicIpAt = Date.now();
    }
  } catch {
    // Keep the previous address. API calls must not fail because this lookup failed.
  } finally {
    clearTimeout(timeoutId);
  }
  return cachedPublicIp;
}

/** Public internet address of the current mobile or Wi-Fi connection. */
export async function getPublicInternetIp() {
  const fresh = cachedPublicIp && Date.now() - cachedPublicIpAt < IP_TTL_MS;
  if (fresh) return cachedPublicIp;
  if (!ipLookupPromise) {
    ipLookupPromise = lookupPublicIp().finally(() => {
      ipLookupPromise = null;
    });
  }
  return ipLookupPromise;
}

/**
 * Identity headers for this mobile app.
 * Does not replace device_id already sent in query params or request bodies.
 */
export async function getClientHeaders() {
  const storedDeviceId = await AsyncStorage.getItem('deviceId');
  const deviceId =
    storedDeviceId && String(storedDeviceId).trim()
      ? String(storedDeviceId).trim()
      : await getDeviceId();
  const publicIp = await getPublicInternetIp();

  const headers = {
    'X-Client': 'mobile',
    'X-Platform': Platform.OS,
    'X-App-Version': APP_VERSION,
    'X-Device-Id': deviceId,
  };
  if (publicIp) {
    headers['X-Client-Public-Ip'] = publicIp;
  }
  return headers;
}

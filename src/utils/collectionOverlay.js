import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../api/apiClient';

const { CollectionOverlay } = NativeModules;
const overlayEmitter =
  Platform.OS === 'android' && CollectionOverlay
    ? new NativeEventEmitter(CollectionOverlay)
    : null;

let overlayLogListenerAttached = false;

function logOverlayApiEvent(event = {}) {
  const { kind, method, url, body, status, responseBody } = event;
  if (kind === 'request') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📤 API REQUEST [OVERLAY][${method}]`, url);
    if (body) console.log('📤 Request body:', body);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }
  if (kind === 'response') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📥 API RESPONSE [OVERLAY][${method}]`, url, '| Status:', status);
    if (responseBody) console.log('📥 Response data:', responseBody);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }
  if (kind === 'error') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(
      `📥 API ERROR [OVERLAY][${method}]`,
      url,
      '| Status:',
      status ?? 'n/a',
      '| Message:',
      body,
    );
    if (responseBody) console.log('📥 Error response data:', responseBody);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }
  if (kind === 'info' && body) {
    console.log(body);
  }
}

/** Mirror native overlay HTTP logs into Metro console. */
export function setupOverlayApiLogListener() {
  if (overlayLogListenerAttached || !overlayEmitter) return () => {};
  overlayLogListenerAttached = true;
  const sub = overlayEmitter.addListener('OverlayApiLog', logOverlayApiEvent);
  return () => {
    sub.remove();
    overlayLogListenerAttached = false;
  };
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseBalanceText(value) {
  if (value == null || value === '') return '';
  return String(value).trim();
}

/**
 * Map delay_proximity.nearby item from POST /attendance/location-tracking
 * into a flat shape the native overlay understands.
 */
export function normalizeNearbyForOverlay(item = {}) {
  const customer = item.customer && typeof item.customer === 'object' ? item.customer : {};
  const loan = item.loan && typeof item.loan === 'object' ? item.loan : {};

  const loanId = parseNumber(item.loan_id ?? loan.id, 0);
  const customerId = parseNumber(item.customer_id ?? customer.id, 0);
  const loanStatus = String(loan.loan_status ?? item.loan_status ?? '');
  const loanStatusName = loan.loan_status_name ?? item.loan_status_name ?? '';
  const isNip =
    loanStatusName.toUpperCase() === 'NIP' ||
    loanStatus === '7' ||
    (loanId > 0 && parseNumber(item.collection_id, 0) <= 0);

  let paymentKind = 'collection';
  if (isNip) {
    paymentKind = 'nip';
  } else if (parseNumber(item.collection_id, 0) > 0) {
    paymentKind = 'collection';
  }

  const balanceRaw = loan.balance_amount ?? item.balance_amount ?? '';
  const balanceText = parseBalanceText(balanceRaw);

  return {
    loan_id: loanId,
    customer_id: customerId,
    customer_name: item.customer_name ?? customer.customer_name ?? 'Customer',
    customer_no: item.customer_no ?? customer.customer_no ?? '',
    customer_phone: customer.customer_phone ?? item.customer_phone ?? '',
    customer_address: customer.customer_address ?? item.customer_address ?? '',
    balance_amount: parseNumber(balanceRaw, 0),
    balance_amount_text: balanceText || String(parseNumber(balanceRaw, 0)),
    distance_meters: parseNumber(item.distance_meters, 0),
    loan_type_name: loan.loan_type_name ?? item.loan_type_name ?? '',
    loan_status_name: loanStatusName,
    branch_name: loan.branch_name ?? item.branch_name ?? '',
    line_name: loan.line_name ?? item.line_name ?? '',
    payment_kind: paymentKind,
    collection_id: parseNumber(item.collection_id, 0),
    remark_id: item.remark_id != null ? parseNumber(item.remark_id, 0) : 0,
  };
}

export function hasCollectibleBalance(item = {}) {
  return normalizeNearbyForOverlay(item).balance_amount > 0;
}

export async function canDrawOverlays() {
  if (Platform.OS !== 'android' || !CollectionOverlay?.canDrawOverlays) {
    return false;
  }
  try {
    return await CollectionOverlay.canDrawOverlays();
  } catch {
    return false;
  }
}

export async function requestOverlayPermission() {
  if (Platform.OS !== 'android' || !CollectionOverlay?.requestOverlayPermission) {
    return;
  }
  const granted = await canDrawOverlays();
  if (!granted) {
    CollectionOverlay.requestOverlayPermission();
  }
}

export async function hideCollectionOverlay() {
  if (Platform.OS !== 'android' || !CollectionOverlay?.hideOverlay) {
    return;
  }
  try {
    CollectionOverlay.hideOverlay();
  } catch {
    // ignore
  }
}

/**
 * Show Android system overlay for nearby payment collection.
 * Works while app is in background if overlay permission is granted.
 */
export async function showCollectionOverlay({
  nearby = [],
  latitude = null,
  longitude = null,
  radiusMeters = 500,
} = {}) {
  if (Platform.OS !== 'android' || !CollectionOverlay?.showOverlay) {
    return { shown: false, reason: 'unsupported_platform' };
  }

  const rawNearby = Array.isArray(nearby) ? nearby : [];
  const validNearby = rawNearby.filter((entry) => {
    const normalized = normalizeNearbyForOverlay(entry);
    const hasIds =
      normalized.loan_id > 0 ||
      normalized.customer_id > 0 ||
      normalized.collection_id > 0;
    return hasIds && normalized.balance_amount > 0;
  });

  if (validNearby.length === 0) {
    return { shown: false, reason: 'no_collectible_balance' };
  }

  const granted = await canDrawOverlays();
  if (!granted) {
    if (__DEV__) {
      console.warn('[collectionOverlay] overlay permission not granted');
    }
    return { shown: false, reason: 'no_permission' };
  }

  const [authToken, userIdRaw] = await Promise.all([
    AsyncStorage.getItem('authToken'),
    AsyncStorage.getItem('userId'),
  ]);

  const payload = {
    apiBaseUrl: API_BASE_URL,
    authToken: authToken || '',
    userId: userIdRaw != null ? Number(userIdRaw) : 0,
    latitude: latitude ?? 0,
    longitude: longitude ?? 0,
    radiusMeters: parseNumber(radiusMeters, 500),
    // Pass raw API nearby entries — native reads nested loan/customer objects.
    nearby: validNearby,
  };

  if (__DEV__) {
    console.log(
      '[collectionOverlay] showing overlay for nearby customers:',
      JSON.stringify(validNearby.map(normalizeNearbyForOverlay), null, 2),
    );
  }

  try {
    await CollectionOverlay.showOverlay(payload);
    return { shown: true, count: validNearby.length };
  } catch (e) {
    if (__DEV__) {
      console.warn('[collectionOverlay] show failed:', e?.message || e);
    }
    return { shown: false, reason: e?.message || 'show_failed' };
  }
}

/**
 * Process delay_proximity from POST /attendance/location-tracking.
 */
export async function handleDelayProximityFromLocationResponse(response, coords = {}) {
  if (Platform.OS !== 'android') {
    return { handled: false, reason: 'unsupported_platform' };
  }

  const delayProximity = response?.delay_proximity;
  const nearby = Array.isArray(delayProximity?.nearby) ? delayProximity.nearby : [];

  if (nearby.length === 0) {
    return { handled: false, reason: 'empty_nearby' };
  }

  const latitude = coords.latitude ?? response?.data?.latitude;
  const longitude = coords.longitude ?? response?.data?.longitude;

  const result = await showCollectionOverlay({
    nearby,
    latitude: latitude != null ? Number(latitude) : null,
    longitude: longitude != null ? Number(longitude) : null,
    radiusMeters: delayProximity?.radius_meters,
  });

  return { handled: true, ...result, notified: delayProximity?.notified };
}

export default {
  canDrawOverlays,
  requestOverlayPermission,
  showCollectionOverlay,
  hideCollectionOverlay,
  handleDelayProximityFromLocationResponse,
  normalizeNearbyForOverlay,
  hasCollectibleBalance,
  setupOverlayApiLogListener,
};

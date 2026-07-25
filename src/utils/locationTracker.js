import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { ATTENDANCE, isAttendanceCheckedIn, setLocalCheckInState } from '../config/appToggles';
import { getServerDateTimeISO } from './dateFormatter';
import { ensureLocationTrackingNotificationSetup } from './locationTrackingNotifications';
import { hasActiveSession } from './sessionManager';

export const LOCATION_TASK_NAME = 'ATTENDANCE_LOCATION_TASK';

const STORAGE_ALLOW_LOCATION = 'attendance_allow_location';
const STORAGE_USER_ALLOW_LOCATION = 'attendance_user_allow_location';
const STORAGE_CAPTURE_TIME = 'attendance_capture_time';
const STORAGE_ATTENDANCE_STATUS = 'attendance_status';
const STORAGE_LAST_SEND_AT = 'attendance_location_last_send_at';

let startedIntervalMinutes = null;
let syncInFlight = null;
let sendInFlight = false;
let captureTimer = null;
let lastSendAtMs = 0;

function formatLocationString(place) {
  if (!place) return '';
  const parts = [
    place.city,
    place.district,
    place.subregion,
    place.region,
    place.state,
    place.country,
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  return [...new Set(parts)].join(', ');
}

function captureTimeMinutes() {
  const n = Number(ATTENDANCE.capture_time);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function captureIntervalMs() {
  return captureTimeMinutes() * 60 * 1000;
}

/** FS runs only while checked in (status 2) with company location enabled. */
function shouldRunForegroundService() {
  return (
    ATTENDANCE.allow_location === 1 &&
    captureTimeMinutes() > 0 &&
    isAttendanceCheckedIn()
  );
}

/** POST /location-tracking — same gate as FS (checked in). */
function shouldSendLocationApi() {
  return shouldRunForegroundService();
}

function isCheckedInFromFlags(flags) {
  return flags.attendance_status === 2;
}

function shouldRunFromFlags(flags) {
  return (
    flags.allow_location === 1 &&
    Number(flags.capture_time) > 0 &&
    isCheckedInFromFlags(flags)
  );
}

function shouldSendFromFlags(flags) {
  return shouldRunFromFlags(flags);
}

export async function persistLocationTrackingFlags() {
  try {
    await AsyncStorage.multiSet([
      [STORAGE_ALLOW_LOCATION, String(ATTENDANCE.allow_location)],
      [STORAGE_USER_ALLOW_LOCATION, String(ATTENDANCE.user_allow_location)],
      [STORAGE_CAPTURE_TIME, String(ATTENDANCE.capture_time)],
      [STORAGE_ATTENDANCE_STATUS, String(ATTENDANCE.attendance_status)],
    ]);
  } catch (e) {
    // ignore
  }
}

/** Read persisted flags without mutating in-memory ATTENDANCE (avoids stale overwrite). */
async function readTrackingFlagsFromStorage() {
  try {
    const pairs = await AsyncStorage.multiGet([
      STORAGE_ALLOW_LOCATION,
      STORAGE_USER_ALLOW_LOCATION,
      STORAGE_CAPTURE_TIME,
      STORAGE_ATTENDANCE_STATUS,
      STORAGE_LAST_SEND_AT,
    ]);
    const allow = pairs?.[0]?.[1];
    const userAllow = pairs?.[1]?.[1];
    const capture = pairs?.[2]?.[1];
    const status = pairs?.[3]?.[1];
    const lastSend = pairs?.[4]?.[1];
    if (lastSend != null && Number.isFinite(Number(lastSend))) {
      lastSendAtMs = Number(lastSend);
    }
    return {
      allow_location: allow === '0' || allow === '1' ? Number(allow) : ATTENDANCE.allow_location,
      user_allow_location:
        userAllow === '0' || userAllow === '1' ? Number(userAllow) : ATTENDANCE.user_allow_location,
      capture_time:
        capture != null && Number.isFinite(Number(capture))
          ? Number(capture)
          : ATTENDANCE.capture_time,
      attendance_status:
        status != null && Number.isFinite(Number(status))
          ? Number(status)
          : ATTENDANCE.attendance_status,
    };
  } catch (e) {
    return {
      allow_location: ATTENDANCE.allow_location,
      user_allow_location: ATTENDANCE.user_allow_location,
      capture_time: captureTimeMinutes(),
      attendance_status: ATTENDANCE.attendance_status,
    };
  }
}

async function markLocationSent(nowMs) {
  lastSendAtMs = nowMs;
  try {
    await AsyncStorage.setItem(STORAGE_LAST_SEND_AT, String(nowMs));
  } catch (e) {
    // ignore
  }
}

function canSendNow(nowMs = Date.now()) {
  const intervalMs = captureIntervalMs();
  if (intervalMs <= 0) return false;
  if (lastSendAtMs <= 0) return true;
  return nowMs - lastSendAtMs >= intervalMs;
}

function canSendNowForFlags(flags, nowMs = Date.now()) {
  const intervalMs = Number(flags.capture_time) * 60 * 1000;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;
  if (lastSendAtMs <= 0) return true;
  return nowMs - lastSendAtMs >= intervalMs;
}

async function sendLocationToApi(coords) {
  if (!coords || sendInFlight) return false;
  if (!(await hasActiveSession())) {
    await teardownLocationTrackingOnLogout();
    return false;
  }
  if (!shouldSendLocationApi()) return false;

  const now = Date.now();
  if (!canSendNow(now)) return false;

  sendInFlight = true;
  try {
    let location = '';
    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (Array.isArray(places) && places.length > 0) {
        location = formatLocationString(places[0]);
      }
    } catch (e) {
      // optional
    }

    const apiServices = require('../api/services/apiServices').default;
    await apiServices.location.send({
      latitude: coords.latitude,
      longitude: coords.longitude,
      location,
      time: getServerDateTimeISO(),
    });

    await markLocationSent(now);

    if (__DEV__) {
      console.log(
        `[locationTracker] posted /location-tracking (next in ${ATTENDANCE.capture_time} min)`
      );
    }
    return true;
  } catch (e) {
    console.warn('[locationTracker] send failed:', e?.message || e);
    return false;
  } finally {
    sendInFlight = false;
  }
}

async function postCurrentLocationIfDue() {
  if (!shouldSendLocationApi() || !canSendNow()) return;
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (pos?.coords) {
      await sendLocationToApi(pos.coords);
    }
  } catch (e) {
    // optional
  }
}

function clearCaptureTimer() {
  if (captureTimer != null) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
}

function restartCaptureTimer() {
  clearCaptureTimer();
  if (!shouldSendLocationApi()) return;

  const ms = captureIntervalMs();
  if (ms <= 0) return;

  void postCurrentLocationIfDue();

  captureTimer = setInterval(() => {
    void postCurrentLocationIfDue();
  }, ms);
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[locationTracker] task error:', error.message);
    return;
  }

  if (!(await hasActiveSession())) {
    await teardownLocationTrackingOnLogout();
    return;
  }

  const flags = await readTrackingFlagsFromStorage();

  // Not allowed / checked out → stop FS (same as company disable).
  if (!shouldRunFromFlags(flags)) {
    await stopLocationTracking();
    return;
  }

  const locations = data?.locations;
  const loc = Array.isArray(locations) && locations.length > 0 ? locations[0] : null;
  if (!loc?.coords) return;

  if (!canSendNowForFlags(flags)) return;

  const now = Date.now();
  if (sendInFlight) return;
  sendInFlight = true;
  try {
    let location = '';
    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (Array.isArray(places) && places.length > 0) {
        location = formatLocationString(places[0]);
      }
    } catch (e) {
      // optional
    }

    const apiServices = require('../api/services/apiServices').default;
    await apiServices.location.send({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      location,
      time: getServerDateTimeISO(),
    });
    await markLocationSent(now);
  } catch (e) {
    console.warn('[locationTracker] task send failed:', e?.message || e);
  } finally {
    sendInFlight = false;
  }
});

export async function stopLocationTracking() {
  clearCaptureTimer();
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (__DEV__) {
        console.log('[locationTracker] FS stopped');
      }
    }
  } catch (e) {
    console.warn('[locationTracker] stop failed:', e?.message || e);
  } finally {
    startedIntervalMinutes = null;
  }
}

/** Stop FS, clear timers, and persist checked-out flags when session ends. */
export async function teardownLocationTrackingOnLogout() {
  clearCaptureTimer();
  sendInFlight = false;
  setLocalCheckInState(false);
  await persistLocationTrackingFlags();
  await stopLocationTracking();
  if (__DEV__) {
    console.log('[locationTracker] tracking torn down on logout');
  }
}

export async function startLocationTracking({ intervalMinutes } = {}) {
  const minutes = Number(intervalMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.warn('[locationTracker] skip start: capture_time missing/invalid', intervalMinutes);
    return;
  }

  try {
    const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (already && startedIntervalMinutes === minutes) {
      await persistLocationTrackingFlags();
      restartCaptureTimer();
      return;
    }

    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      console.warn('[locationTracker] skip start: foreground location denied');
      return;
    }

    await Location.requestBackgroundPermissionsAsync();

    await ensureLocationTrackingNotificationSetup();
    await persistLocationTrackingFlags();

    if (already) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    const intervalMs = minutes * 60 * 1000;
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: intervalMs,
      distanceInterval: 0,
      deferredUpdatesInterval: intervalMs,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'SunCollection',
        notificationBody: 'Location tracking is active — do not dismiss',
        notificationColor: '#1d7ee2',
        killServiceOnDestroy: false,
      },
    });

    startedIntervalMinutes = minutes;

    if (__DEV__) {
      console.log('[locationTracker] FS started', {
        platform: Platform.OS,
        capture_time_min: minutes,
        allow_location: ATTENDANCE.allow_location,
        checkedIn: isAttendanceCheckedIn(),
      });
    }

    restartCaptureTimer();
  } catch (e) {
    console.warn('[locationTracker] start failed:', e?.message || e);
    startedIntervalMinutes = null;
    clearCaptureTimer();
  }
}

/**
 * Check-in + allow_location + capture_time → start / keep FS.
 * Check-out or allow_location off → stop FS.
 * If user stopped FS from system "background activity", next open restarts when still checked in.
 */
export async function syncLocationTracking() {
  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = (async () => {
    if (!(await hasActiveSession())) {
      await stopLocationTracking();
      return;
    }

    const minutes = captureTimeMinutes();
    const wantFs = shouldRunForegroundService();
    const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
      () => false
    );

    if (!wantFs) {
      if (already || startedIntervalMinutes != null) {
        await stopLocationTracking();
      } else {
        clearCaptureTimer();
      }
      return;
    }

    await persistLocationTrackingFlags();

    // Always (re)start if OS stopped the service (e.g. user tapped Stop in background activity).
    if (already && startedIntervalMinutes === minutes) {
      restartCaptureTimer();
      return;
    }

    await startLocationTracking({ intervalMinutes: minutes });
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Attendance / location toggles — same shape from:
 *   GET /appversion
 *   GET /frontcash/dashboard/today
 * applyAttendanceFromResponse() works for both.
 */
export const ATTENDANCE = {
  allow_attendance: 1,
  allow_location: 0,
  /** Server flag for location feature per user (not A/P UI state) */
  user_allow_location: 0,
  capture_time: 0,
  /** 1 = allowed until API says 0 — avoids false block on cold start */
  within_time: 1,
  /**
   * 0/1 = Absent, 2 = Checked in, 3 = Closed
   * A/P toggle follows this only.
   */
  attendance_status: 0,
};

const STORAGE_ALLOW_LOCATION = 'attendance_allow_location';
const STORAGE_USER_ALLOW_LOCATION = 'attendance_user_allow_location';
const STORAGE_CAPTURE_TIME = 'attendance_capture_time';
const STORAGE_ATTENDANCE_STATUS = 'attendance_status';
const STORAGE_WITHIN_TIME = 'attendance_within_time';

const appBlockListeners = new Set();

/** Subscribe to within_time block changes (AppBlockGate). */
export function subscribeAppBlock(listener) {
  appBlockListeners.add(listener);
  listener(ATTENDANCE.within_time === 0);
  return () => appBlockListeners.delete(listener);
}

function notifyAppBlockChange() {
  const blocked = ATTENDANCE.within_time === 0;
  appBlockListeners.forEach((listener) => listener(blocked));
}

/** Restore persisted attendance flags before first appversion response. */
export async function restoreAttendanceFromStorage() {
  try {
    const pairs = await AsyncStorage.multiGet([
      STORAGE_WITHIN_TIME,
      STORAGE_ALLOW_LOCATION,
      STORAGE_USER_ALLOW_LOCATION,
      STORAGE_CAPTURE_TIME,
      STORAGE_ATTENDANCE_STATUS,
    ]);
    const within = pairs?.[0]?.[1];
    const allow = pairs?.[1]?.[1];
    const userAllow = pairs?.[2]?.[1];
    const capture = pairs?.[3]?.[1];
    const status = pairs?.[4]?.[1];

    if (within === '0' || within === '1') {
      ATTENDANCE.within_time = Number(within);
    }
    if (allow === '0' || allow === '1') {
      ATTENDANCE.allow_location = Number(allow);
    }
    if (userAllow === '0' || userAllow === '1') {
      ATTENDANCE.user_allow_location = Number(userAllow);
    }
    if (capture != null && Number.isFinite(Number(capture))) {
      ATTENDANCE.capture_time = Number(capture);
    }
    if (status != null && Number.isFinite(Number(status))) {
      ATTENDANCE.attendance_status = Number(status);
    }
    notifyAppBlockChange();
  } catch (e) {
    // ignore
  }
}

function getAttendancePayload(res) {
  if (!res || typeof res !== 'object') return null;
  // Nested: { data: { attendance } } | { response: { attendance } } | { attendance }
  const d = res.data ?? res.response ?? res;
  if (!d || typeof d !== 'object') return null;
  if (d.attendance && typeof d.attendance === 'object') return d.attendance;
  // Flat attendance fields on the unwrapped payload
  if (
    d.allow_attendance != null ||
    d.allow_location != null ||
    d.user_allow_location != null ||
    d.attendance_status != null ||
    d.capture_time != null ||
    d.within_time != null
  ) {
    return d;
  }
  return null;
}

/** Maps attendance.within_time — 0 blocks app, 1 allows. */
export function applyAppBlockFromResponse(res) {
  const a = getAttendancePayload(res);
  if (!a || typeof a !== 'object') return;
  if (a.within_time === 0 || a.within_time === 1) {
    ATTENDANCE.within_time = a.within_time;
    AsyncStorage.setItem(STORAGE_WITHIN_TIME, String(a.within_time)).catch(() => {});
    notifyAppBlockChange();
  }
}

/** Present when attendance_status is 2 — not user_allow_location. */
export function isAttendanceCheckedIn() {
  return ATTENDANCE.attendance_status === 2;
}

export function isAttendanceClosed() {
  return ATTENDANCE.attendance_status === 3;
}

function persistAttendanceFlags() {
  AsyncStorage.multiSet([
    [STORAGE_ALLOW_LOCATION, String(ATTENDANCE.allow_location)],
    [STORAGE_USER_ALLOW_LOCATION, String(ATTENDANCE.user_allow_location)],
    [STORAGE_CAPTURE_TIME, String(ATTENDANCE.capture_time)],
    [STORAGE_ATTENDANCE_STATUS, String(ATTENDANCE.attendance_status)],
    [STORAGE_WITHIN_TIME, String(ATTENDANCE.within_time)],
  ]).catch(() => {});
}

/** Maps allow_attendance, allow_location, user_allow_location, capture_time, attendance_status, server_date */
export function applyAttendanceFromResponse(res) {
  const a = getAttendancePayload(res);
  if (a && typeof a === 'object') {
    if (a.allow_attendance === 0 || a.allow_attendance === 1) {
      ATTENDANCE.allow_attendance = a.allow_attendance;
    }

    if (a.allow_location === 0 || a.allow_location === 1) {
      ATTENDANCE.allow_location = a.allow_location;
    }

    if (a.user_allow_location === 0 || a.user_allow_location === 1) {
      ATTENDANCE.user_allow_location = a.user_allow_location;
    }

    if (a.capture_time != null && Number.isFinite(Number(a.capture_time))) {
      ATTENDANCE.capture_time = Number(a.capture_time);
    }

    if (a.attendance_status != null && Number.isFinite(Number(a.attendance_status))) {
      ATTENDANCE.attendance_status = Number(a.attendance_status);
      notifyAttendanceEntryChange();
    }

    if (a.within_time === 0 || a.within_time === 1) {
      ATTENDANCE.within_time = a.within_time;
      notifyAppBlockChange();
    }

    persistAttendanceFlags();
  }

  applyCalendarTimezoneFromResponse(res);
}

/** Local check-in / checkout — UI + tracking follow attendance_status. */
export function setLocalCheckInState(checkedIn) {
  ATTENDANCE.attendance_status = checkedIn ? 2 : 0;
  persistAttendanceFlags();
  notifyAttendanceEntryChange();
}

/** After check-out for the day — blocks another punch-in until admin resets. */
export function setLocalAttendanceClosed() {
  ATTENDANCE.attendance_status = 3;
  persistAttendanceFlags();
  notifyAttendanceEntryChange();
}

const attendanceEntryListeners = new Set();

function notifyAttendanceEntryChange() {
  attendanceEntryListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      // ignore
    }
  });
}

/** Subscribe to check-in state changes (entry gating UI). */
export function subscribeAttendanceEntry(listener) {
  attendanceEntryListeners.add(listener);
  return () => attendanceEntryListeners.delete(listener);
}

/** Server calendar — server_date from GET /appversion (and dashboard when present). */
export const CALENDAR_TZ = {
  timezone: 'Asia/Kolkata',
  server_date: '',
};

function getAppResponsePayload(res) {
  if (!res || typeof res !== 'object') return null;
  const d = res.data ?? res.response ?? res;
  return d && typeof d === 'object' ? d : null;
}

export function applyCalendarTimezoneFromResponse(res) {
  const d = getAppResponsePayload(res);
  if (!d) return;
  if (typeof d.timezone === 'string' && d.timezone.trim()) {
    CALENDAR_TZ.timezone = d.timezone.trim();
  }
  if (typeof d.server_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.server_date)) {
    CALENDAR_TZ.server_date = d.server_date;
  }
}

import { ATTENDANCE, isAttendanceCheckedIn } from '../config/appToggles';
import { showWarning } from './alertService';

/** When company enables attendance, non-expense entries require check-in. */
export function isAttendanceGatingEnabled() {
  return ATTENDANCE.allow_attendance === 1;
}

/** True when user may submit entries other than expenses. */
export function canMakeAttendanceGatedEntry() {
  if (!isAttendanceGatingEnabled()) return true;
  return isAttendanceCheckedIn();
}

/**
 * Block non-expense entry when not checked in; shows alert.
 * @returns {boolean} true if entry is allowed
 */
export function guardAttendanceGatedEntry(t) {
  if (canMakeAttendanceGatedEntry()) return true;
  showWarning(
    t('home.entryBlockedTitle'),
    t('home.entryBlockedMessage'),
  );
  return false;
}

import {
  ACCOUNT,
  ATTENDANCE,
  isAccountClosed,
  isAttendanceCheckedIn,
} from '../config/appToggles';
import { showWarning } from './alertService';

/** When company enables attendance, non-expense entries require check-in. */
export function isAttendanceGatingEnabled() {
  return ATTENDANCE.allow_attendance === 1;
}

/** True when user may submit entries other than expenses. */
export function canMakeAttendanceGatedEntry() {
  if (isAccountClosed()) return false;
  if (!isAttendanceGatingEnabled()) return true;
  return isAttendanceCheckedIn();
}

/**
 * Block entries when dashboard closing_status === 1 (ACCOUNT.isAccountClosed).
 * closing_status === 0 → allow (then attendance check).
 * @returns {boolean} true if entry is allowed
 */
export function guardAttendanceGatedEntry(t) {
  // Read live ACCOUNT flag every call (do not cache).
  if (ACCOUNT.isAccountClosed === true || isAccountClosed()) {
    showWarning(
      t('home.accountClosedTitle'),
      t('home.accountClosedMessage'),
    );
    return false;
  }
  if (canMakeAttendanceGatedEntry()) return true;
  showWarning(
    t('home.entryBlockedTitle'),
    t('home.entryBlockedMessage'),
  );
  return false;
}

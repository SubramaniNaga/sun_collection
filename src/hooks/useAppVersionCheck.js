import { useCallback, useRef, useState } from 'react';
import {
  applyAppBlockFromResponse,
  applyAttendanceFromResponse,
} from '../config/appToggles';
import { useLanguage } from '../store/LanguageContext';
import { showWarning } from '../utils/alertService';
import { evaluateAppVersion } from '../utils/appVersionCheck';
import { syncLocationTracking } from '../utils/locationTracker';

/** /appversion: maintenance + update sheet + same attendance flags as dashboard/today. */
export function useAppVersionCheck() {
  const { t } = useLanguage();
  const [updatePayload, setUpdatePayload] = useState(null);
  const clearUpdate = useCallback(() => setUpdatePayload(null), []);

  const implRef = useRef();
  implRef.current = async () => {
    const result = await evaluateAppVersion();

    // Same attendance / within_time mapping as GET /frontcash/dashboard/today
    if (result.payload) {
      applyAppBlockFromResponse(result.payload);
      applyAttendanceFromResponse(result.payload);
      syncLocationTracking().catch(() => {});
    }

    if (result.kind === 'maintenance') {
      showWarning(
        t('auth.maintenanceMode'),
        result.message || t('auth.maintenanceInProgress'),
        [{ text: t('common.retry'), onPress: () => void implRef.current?.() }]
      );
      return;
    }

    if (result.kind === 'update') {
      setUpdatePayload({
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        forceUpdate: result.forceUpdate,
        storeUrl: result.storeUrl,
      });
      return;
    }

    if (result.kind === 'ok') {
      setUpdatePayload(null);
    }
  };

  const runCheck = useCallback(async () => {
    await implRef.current?.();
  }, []);

  return { runCheck, updatePayload, clearUpdate };
}

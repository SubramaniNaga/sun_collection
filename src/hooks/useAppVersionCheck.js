import { useCallback, useRef, useState } from 'react';
import { useLanguage } from '../store/LanguageContext';
import { showWarning } from '../utils/alertService';
import { evaluateAppVersion } from '../utils/appVersionCheck';

/**
 * Calls /appversion on demand: maintenance alert + update bottom sheet when app is behind API.
 */
export function useAppVersionCheck() {
  const { t } = useLanguage();
  const [updatePayload, setUpdatePayload] = useState(null);
  const clearUpdate = useCallback(() => setUpdatePayload(null), []);

  const implRef = useRef();
  implRef.current = async () => {
    const result = await evaluateAppVersion();

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

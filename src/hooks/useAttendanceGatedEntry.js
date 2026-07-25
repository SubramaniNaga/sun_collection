import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { subscribeAttendanceEntry } from '../config/appToggles';
import { canMakeAttendanceGatedEntry } from '../utils/attendanceEntryGate';

/** Reactive check-in gate for entry screens (expenses are exempt — do not use there). */
export function useAttendanceGatedEntry() {
  const [canEnter, setCanEnter] = useState(() => canMakeAttendanceGatedEntry());

  useEffect(() => {
    return subscribeAttendanceEntry(() => {
      setCanEnter(canMakeAttendanceGatedEntry());
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setCanEnter(canMakeAttendanceGatedEntry());
    }, []),
  );

  return canEnter;
}

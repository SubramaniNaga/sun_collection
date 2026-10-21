import { NativeModules, Platform } from 'react-native';
import { isAppLoggingEnabled } from '../config/logConfig';

const loggingEnabled = isAppLoggingEnabled();

if (!loggingEnabled) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
  console.error = noop;
}

if (Platform.OS === 'android' && NativeModules.CollectionOverlay?.setLoggingEnabled) {
  NativeModules.CollectionOverlay.setLoggingEnabled(loggingEnabled);
}

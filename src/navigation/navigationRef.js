import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let pendingHomeFromNotification = false;

export function requestHomeFromNotification() {
  pendingHomeFromNotification = true;
  tryFlushNotificationNavigation();
}

export function tryFlushNotificationNavigation() {
  if (!pendingHomeFromNotification || !navigationRef.isReady()) {
    return;
  }

  const rootNames = navigationRef.getRootState()?.routeNames ?? [];
  if (!rootNames.includes('Home')) {
    return;
  }

  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'Home',
      params: { screen: 'HomeScreen' },
    })
  );
  pendingHomeFromNotification = false;
}

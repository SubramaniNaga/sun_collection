/**
 * Safe back navigation: uses goBack when possible, otherwise navigates to Home.
 * Prevents "GO_BACK was not handled by any navigator" on drawer root screens (e.g. Profile).
 */
export function safeGoBack(navigation) {
  if (!navigation) return;

  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }

  const parent = navigation.getParent?.();
  if (parent?.canGoBack?.()) {
    parent.goBack();
    return;
  }

  const state = navigation.getState?.();
  const routeNames = state?.routeNames ?? [];

  if (routeNames.includes('HomeScreen')) {
    navigation.navigate('HomeScreen');
    return;
  }

  navigation.navigate('Home');
}

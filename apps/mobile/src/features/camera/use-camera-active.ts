import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * The camera runs only while its screen is focused and the app is in the foreground,
 * so it never drains the battery or holds the sensor in the background.
 */
export function useCameraActive(): boolean {
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => {
      subscription.remove();
    };
  }, []);

  return isFocused && appState === 'active';
}

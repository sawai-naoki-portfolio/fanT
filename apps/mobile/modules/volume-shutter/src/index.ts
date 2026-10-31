import { requireOptionalNativeModule, type EventSubscription } from 'expo';

interface VolumeShutterModule {
  setEnabled(enabled: boolean): void;
  addListener(event: 'onPress', listener: () => void): EventSubscription;
}

/** `null` where the native module is not built in (e.g. tests, web). */
const native = requireOptionalNativeModule<VolumeShutterModule>('VolumeShutter');

/**
 * Listens for the volume buttons as a shutter (CAM-03) until the returned function
 * is called. Does nothing where the platform does not support it.
 */
export function listenToVolumeShutter(onPress: () => void): () => void {
  if (native === null) return () => undefined;
  const subscription = native.addListener('onPress', onPress);
  native.setEnabled(true);
  return () => {
    native.setEnabled(false);
    subscription.remove();
  };
}

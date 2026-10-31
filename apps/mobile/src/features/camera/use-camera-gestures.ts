import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import type { CameraViewHandle, LensCapabilities } from '../../engine/camera-view';

/** How long the focus ring and exposure slider stay after the last touch. */
const FOCUS_UI_MS = 3000;
/** Digital zoom beyond this only blurs the picture. */
const MAX_ZOOM = 10;

export interface FocusPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Preview gestures: tap to focus (CAM-08) or to shoot when that setting is on,
 * and pinch to zoom on the UI thread (CAM-09).
 */
export function useCameraGestures({
  camera,
  zoom,
  capabilities,
  tapToShoot,
  onShoot,
}: {
  readonly camera: RefObject<CameraViewHandle | null>;
  readonly zoom: SharedValue<number>;
  readonly capabilities: LensCapabilities | null;
  readonly tapToShoot: boolean;
  readonly onShoot: () => void;
}) {
  const [focus, setFocus] = useState<FocusPoint | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Keeps the focus UI up for a while longer (e.g. while the exposure is adjusted). */
  const keepFocus = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setFocus(null);
    }, FOCUS_UI_MS);
  };
  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
    },
    [],
  );

  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (event) => {
      if (tapToShoot) {
        onShoot();
        return;
      }
      setFocus({ x: event.x, y: event.y });
      keepFocus();
      void camera.current?.focus({ x: event.x, y: event.y });
    },
  });

  const zoomAtStart = useSharedValue(1);
  const minZoom = capabilities?.minZoom ?? 1;
  const maxZoom = Math.min(capabilities?.maxZoom ?? 1, MAX_ZOOM);
  const pinch = usePinchGesture({
    onBegin: () => {
      'worklet';
      zoomAtStart.set(zoom.get());
    },
    onUpdate: (event) => {
      'worklet';
      zoom.set(Math.min(maxZoom, Math.max(minZoom, zoomAtStart.get() * event.scale)));
    },
  });

  return { gestures: useSimultaneousGestures(tap, pinch), focus, keepFocus };
}

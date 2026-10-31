import { router } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';

import type { CameraViewHandle, Lens } from '../../engine/camera-view';
import { sleep } from '../../lib/sleep';
import { strings } from '../../i18n';
import { showError } from '../../ui/dialogs';
import { haptics } from '../../ui/haptics';
import { reportError, track } from '../analytics/analytics';
import { ASPECT_VALUES, centerCrop } from '../photo/geometry';
import { createPhoto } from '../photo/photo-service';
import { newRecipe } from '../photo/recipe';
import { useCameraSettings } from './camera-store';
import type { CameraLook } from './use-camera-look';

export type ShutterStatus = 'idle' | 'countdown' | 'capturing';

const SCREEN_FLASH_MS = 350;

interface ShutterOptions {
  readonly camera: RefObject<CameraViewHandle | null>;
  readonly look: CameraLook;
  readonly seed: number;
  readonly lens: Lens;
  /** Called with the new seed after each shot, so the next one gets new grain (FLM-06). */
  readonly onShot: () => void;
}

/**
 * The shutter (CAM-03): self-timer (CAM-07), flash or screen flash (CAM-06), the
 * full-resolution capture with the previewed look (07 §5.2), then the result (S-20).
 */
export function useShutter({ camera, look, seed, lens, onShot }: ShutterOptions) {
  const [status, setStatus] = useState<ShutterStatus>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [screenFlash, setScreenFlash] = useState(false);
  const busy = useRef(false);

  const shoot = async () => {
    if (busy.current) return;
    busy.current = true;
    const { timer, flash, aspect, beauty, faceShape, makeup, mode } = useCameraSettings.getState();
    try {
      if (timer > 0) {
        setStatus('countdown');
        for (let remaining = timer; remaining > 0; remaining--) {
          setCountdown(remaining);
          haptics.select();
          await sleep(1000);
        }
        setCountdown(null);
      }
      setStatus('capturing');
      const useScreenFlash = lens === 'front' && flash !== 'off';
      if (useScreenFlash) {
        setScreenFlash(true);
        await sleep(SCREEN_FLASH_MS);
      }
      const handle = camera.current;
      if (handle === null) throw new Error('Camera is not ready');
      const captured = await handle
        .capture({ flash: lens === 'back' ? flash : 'off' })
        .finally(() => {
          setScreenFlash(false);
        });
      // A film-advance tap (CAM-11).
      haptics.press();

      const photo = await createPhoto({
        kind: 'camera',
        original: captured.bytes,
        recipeFor: (size) =>
          newRecipe({
            filmId: look.film.id,
            intensity: look.intensity,
            beauty,
            faceShape,
            makeup,
            dateStamp: look.dateStamp,
            character:
              mode === 'character' && look.character !== null
                ? { id: look.character.character.id, variantId: look.character.variant.id }
                : null,
            seed,
            // Saved as previewed (D-08): mirrored for the front camera.
            mirror: (lens === 'front') !== captured.isMirrored,
            crop: centerCrop(size, ASPECT_VALUES[aspect]),
          }),
      });
      track({ name: 'photo_taken', mode, filmId: look.film.id });
      onShot();
      router.push({ pathname: '/photo/[id]', params: { id: photo.id, from: 'camera' } });
    } catch (error) {
      reportError(error, 'camera.capture');
      showError(strings.camera.captureFailed);
    } finally {
      setCountdown(null);
      setStatus('idle');
      busy.current = false;
    }
  };

  return { status, countdown, screenFlash, shoot };
}

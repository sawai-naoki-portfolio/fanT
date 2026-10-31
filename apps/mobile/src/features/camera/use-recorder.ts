import { router } from 'expo-router';
import { useEffect, useRef, useState, type RefObject } from 'react';

import type { CameraViewHandle } from '../../engine/camera-view';
import { strings } from '../../i18n';
import { showError } from '../../ui/dialogs';
import { haptics } from '../../ui/haptics';
import { reportError } from '../analytics/analytics';
import { MAX_VIDEO_SECONDS, saveVideo } from '../video/video-service';
import type { CameraLook } from './use-camera-look';

/**
 * Short videos (CAM-13): the shutter starts and stops recording (at most
 * `MAX_VIDEO_SECONDS`), then the recording is coloured with the film it started
 * with and opens like a photo.
 */
export function useRecorder({
  camera,
  look,
}: {
  readonly camera: RefObject<CameraViewHandle | null>;
  readonly look: CameraLook;
}) {
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicker = () => {
    if (ticker.current !== null) clearInterval(ticker.current);
    ticker.current = null;
    setElapsed(null);
  };
  useEffect(() => {
    const handle = camera.current;
    // Leaving the camera ends a recording; it is then discarded as failed.
    return () => {
      if (ticker.current !== null) clearInterval(ticker.current);
      void handle?.stopRecording();
    };
  }, [camera]);

  const start = async () => {
    const handle = camera.current;
    if (handle === null || saving) return;
    // The film it starts with, even if another is picked while recording.
    const { film, intensity } = look;
    const startedAt = Date.now();
    try {
      await handle.startRecording({
        maxSeconds: MAX_VIDEO_SECONDS,
        onFinished: (path) => {
          stopTicker();
          setSaving(true);
          void saveVideo({ recording: path, film, intensity })
            .then((photo) => {
              router.push({ pathname: '/photo/[id]', params: { id: photo.id, from: 'camera' } });
            })
            .catch((error: unknown) => {
              reportError(error, 'camera.video.save');
              showError(strings.camera.videoFailed);
            })
            .finally(() => {
              setSaving(false);
            });
        },
        onError: (error) => {
          stopTicker();
          reportError(error, 'camera.video.record');
          showError(strings.camera.videoFailed);
        },
      });
      haptics.press();
      setElapsed(0);
      ticker.current = setInterval(() => {
        setElapsed(Math.min(MAX_VIDEO_SECONDS, Math.floor((Date.now() - startedAt) / 1000)));
      }, 250);
    } catch (error) {
      stopTicker();
      reportError(error, 'camera.video.start');
      showError(strings.camera.videoFailed);
    }
  };

  const stop = async () => {
    haptics.press();
    try {
      await camera.current?.stopRecording();
    } catch (error) {
      reportError(error, 'camera.video.stop');
    }
  };

  return {
    recording: elapsed !== null,
    elapsed,
    saving,
    toggle: () => {
      void (elapsed === null ? start() : stop());
    },
  };
}

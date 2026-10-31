import { useCallback, useMemo, useState } from 'react';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import {
  emptyWindow,
  isWindowComplete,
  recordFrame,
  summarize,
  type FrameSample,
  type FrameStatsSummary,
  type FrameStatsWindow,
} from '../features/performance/frame-stats.worklet';

export interface FrameStats {
  /** The latest one-second summary; `null` until the first one arrives. */
  readonly stats: FrameStatsSummary | null;
  /** Frame-thread worklet that records one frame's timings. */
  readonly record: (sample: FrameSample) => void;
}

/**
 * Collects frame timings on the camera frame thread and hands a summary to the JS
 * thread once a second, so measuring adds one JS update a second, not one per frame.
 */
export function useFrameStats(): FrameStats {
  const [stats, setStats] = useState<FrameStatsSummary | null>(null);
  const current = useMemo(() => createSynchronizable<FrameStatsWindow | null>(null), []);

  const record = useCallback(
    (sample: FrameSample) => {
      'worklet';
      const now = performance.now();
      const window = recordFrame(current.getBlocking() ?? emptyWindow(now), sample);
      if (isWindowComplete(window, now)) {
        scheduleOnRN(setStats, summarize(window, now));
        current.setBlocking(emptyWindow(now));
      } else {
        current.setBlocking(window);
      }
    },
    [current],
  );

  return { stats, record };
}

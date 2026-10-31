import { FULL_QUALITY, REDUCED_QUALITY } from '@fant/filters';
import { useEffect, useState } from 'react';

import type { FrameStatsSummary } from './frame-stats.worklet';

/** Below this the preview no longer keeps its fixed 24 fps (D-07). */
const MIN_FPS = 21;
/** Seconds in a row below `MIN_FPS` before lowering the quality. */
const SLOW_SECONDS = 3;

export interface QualityState {
  readonly quality: number;
  readonly slowSeconds: number;
}

export const INITIAL_QUALITY: QualityState = { quality: FULL_QUALITY, slowSeconds: 0 };

/**
 * Lowers the preview quality once the frame rate has stayed low for a few seconds
 * (03 §2), and keeps it lowered for the session so the preview does not flicker
 * between qualities. Saved photos always render at full quality.
 */
export function nextQuality(state: QualityState, stats: FrameStatsSummary): QualityState {
  if (state.quality === REDUCED_QUALITY) return state;
  const slowSeconds = stats.fps > 0 && stats.fps < MIN_FPS ? state.slowSeconds + 1 : 0;
  return slowSeconds >= SLOW_SECONDS
    ? { quality: REDUCED_QUALITY, slowSeconds }
    : { quality: state.quality, slowSeconds };
}

/** The preview quality for the latest one-second frame statistics. */
export function useAdaptiveQuality(stats: FrameStatsSummary | null): number {
  const [state, setState] = useState(INITIAL_QUALITY);
  useEffect(() => {
    if (stats === null) return;
    void Promise.resolve().then(() => {
      setState((current) => nextQuality(current, stats));
    });
  }, [stats]);
  return state.quality;
}

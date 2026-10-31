import { REDUCED_QUALITY } from '@fant/filters';
import { describe, expect, it } from 'vitest';

import { INITIAL_QUALITY, nextQuality, type QualityState } from './adaptive-quality';

const window = (fps: number) => ({
  fps,
  renderAvgMs: 10,
  renderMaxMs: 12,
  analysisAvgMs: null,
  analysisMaxMs: null,
});

function run(fpsValues: readonly number[]): QualityState {
  return fpsValues.reduce((state, fps) => nextQuality(state, window(fps)), INITIAL_QUALITY);
}

describe('nextQuality', () => {
  it('stays full while the preview keeps up', () => {
    expect(run([24, 23.8, 22, 24]).quality).toBe(1);
  });

  it('ignores a short dip', () => {
    expect(run([18, 18, 24, 18, 18]).quality).toBe(1);
  });

  it('lowers the quality after three slow seconds and keeps it lowered', () => {
    expect(run([20, 19, 18]).quality).toBe(REDUCED_QUALITY);
    expect(run([20, 19, 18, 24, 24]).quality).toBe(REDUCED_QUALITY);
  });

  it('ignores empty windows (camera paused)', () => {
    expect(run([0, 0, 0, 0]).quality).toBe(1);
  });
});

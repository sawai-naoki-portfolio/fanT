import { describe, expect, it } from 'vitest';

import {
  emptyWindow,
  isWindowComplete,
  recordFrame,
  summarize,
  type FrameSample,
} from './frame-stats.worklet';

const record = (samples: readonly FrameSample[], startedAt = 0) =>
  samples.reduce(recordFrame, emptyWindow(startedAt));

describe('frame stats', () => {
  it('reports frames per second over the elapsed time', () => {
    const window = record(Array.from({ length: 12 }, () => ({ renderMs: 1, analysisMs: null })));
    expect(summarize(window, 500).fps).toBe(24);
  });

  it('averages render time over every frame and keeps the slowest one', () => {
    const window = record([
      { renderMs: 2, analysisMs: null },
      { renderMs: 6, analysisMs: null },
      { renderMs: 4, analysisMs: null },
    ]);
    expect(summarize(window, 1000)).toMatchObject({ renderAvgMs: 4, renderMaxMs: 6 });
  });

  it('averages analysis time over the analyzed frames only', () => {
    const window = record([
      { renderMs: 1, analysisMs: 10 },
      { renderMs: 1, analysisMs: null },
      { renderMs: 1, analysisMs: 20 },
      { renderMs: 1, analysisMs: null },
    ]);
    expect(summarize(window, 1000)).toMatchObject({ analysisAvgMs: 15, analysisMaxMs: 20 });
  });

  it('reports no analysis time when face detection is off', () => {
    const window = record([{ renderMs: 1, analysisMs: null }]);
    expect(summarize(window, 1000)).toMatchObject({ analysisAvgMs: null, analysisMaxMs: null });
  });

  it('reports zeros for a window without frames', () => {
    expect(summarize(emptyWindow(0), 0)).toEqual({
      fps: 0,
      renderAvgMs: 0,
      renderMaxMs: 0,
      analysisAvgMs: null,
      analysisMaxMs: null,
    });
  });

  it('completes a window after one second', () => {
    const window = emptyWindow(100);
    expect(isWindowComplete(window, 1099)).toBe(false);
    expect(isWindowComplete(window, 1100)).toBe(true);
  });
});

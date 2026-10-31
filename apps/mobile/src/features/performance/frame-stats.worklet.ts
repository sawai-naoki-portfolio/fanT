/** Timings of one camera frame on the frame thread, in milliseconds. */
export interface FrameSample {
  /** Time spent drawing the frame through the filters. */
  readonly renderMs: number;
  /** Time spent on face detection, or `null` when this frame was not analyzed. */
  readonly analysisMs: number | null;
}

/** Running totals for the frames seen since `startedAt`. */
export interface FrameStatsWindow {
  readonly startedAt: number;
  readonly frames: number;
  readonly renderTotalMs: number;
  readonly renderMaxMs: number;
  readonly analyses: number;
  readonly analysisTotalMs: number;
  readonly analysisMaxMs: number;
}

export interface FrameStatsSummary {
  /** Frames that reached the frame callback per second. */
  readonly fps: number;
  readonly renderAvgMs: number;
  readonly renderMaxMs: number;
  /** `null` when no frame in the window was analyzed (face detection off). */
  readonly analysisAvgMs: number | null;
  readonly analysisMaxMs: number | null;
}

/** How often the totals are summarized and restarted. */
const STATS_WINDOW_MS = 1000;

/**
 * Pure helpers for measuring the preview on the camera frame thread (P-1 in
 * docs/requirements/07-system-architecture.md §10). Marked as worklets so they can
 * run there.
 */
export function emptyWindow(startedAt: number): FrameStatsWindow {
  'worklet';
  return {
    startedAt,
    frames: 0,
    renderTotalMs: 0,
    renderMaxMs: 0,
    analyses: 0,
    analysisTotalMs: 0,
    analysisMaxMs: 0,
  };
}

export function recordFrame(window: FrameStatsWindow, sample: FrameSample): FrameStatsWindow {
  'worklet';
  const { renderMs, analysisMs } = sample;
  return {
    startedAt: window.startedAt,
    frames: window.frames + 1,
    renderTotalMs: window.renderTotalMs + renderMs,
    renderMaxMs: Math.max(window.renderMaxMs, renderMs),
    analyses: window.analyses + (analysisMs === null ? 0 : 1),
    analysisTotalMs: window.analysisTotalMs + (analysisMs ?? 0),
    analysisMaxMs: Math.max(window.analysisMaxMs, analysisMs ?? 0),
  };
}

/** Whether the window has run long enough to summarize. */
export function isWindowComplete(window: FrameStatsWindow, now: number): boolean {
  'worklet';
  return now - window.startedAt >= STATS_WINDOW_MS;
}

export function summarize(window: FrameStatsWindow, now: number): FrameStatsSummary {
  'worklet';
  const elapsedMs = now - window.startedAt;
  const analyzed = window.analyses > 0;
  return {
    fps: elapsedMs > 0 ? (window.frames * 1000) / elapsedMs : 0,
    renderAvgMs: window.frames > 0 ? window.renderTotalMs / window.frames : 0,
    renderMaxMs: window.renderMaxMs,
    analysisAvgMs: analyzed ? window.analysisTotalMs / window.analyses : null,
    analysisMaxMs: analyzed ? window.analysisMaxMs : null,
  };
}

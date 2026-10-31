/** Undo/redo over immutable states (EDT-05). */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

/** Steps kept for undo; older ones are dropped to bound memory. */
export const MAX_HISTORY = 50;

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Records a new state; redo is no longer possible after a new change. */
export function commit<T>(history: History<T>, next: T): History<T> {
  if (Object.is(next, history.present)) return history;
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    present: next,
    future: [],
  };
}

/** Replaces the present without a new undo step (e.g. while a slider is dragged). */
export function replace<T>(history: History<T>, next: T): History<T> {
  return { ...history, present: next };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}

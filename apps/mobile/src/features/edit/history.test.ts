import { describe, expect, it } from 'vitest';

import { commit, MAX_HISTORY, redo, replace, startHistory, undo } from './history';

describe('history', () => {
  it('undoes and redoes in order', () => {
    let history = commit(commit(startHistory(1), 2), 3);
    history = undo(history);
    expect(history.present).toBe(2);
    history = undo(history);
    expect(history.present).toBe(1);
    expect(undo(history)).toBe(history);
    history = redo(redo(history));
    expect(history.present).toBe(3);
    expect(redo(history)).toBe(history);
  });

  it('drops redo after a new change', () => {
    const history = commit(undo(commit(startHistory('a'), 'b')), 'c');
    expect(history.future).toEqual([]);
    expect(history.past).toEqual(['a']);
  });

  it('ignores a commit of the same state and replaces without a step', () => {
    const history = startHistory({ v: 1 });
    expect(commit(history, history.present)).toBe(history);
    expect(replace(history, { v: 2 }).past).toEqual([]);
  });

  it('keeps a bounded number of steps', () => {
    let history = startHistory(0);
    for (let i = 1; i <= MAX_HISTORY + 10; i++) history = commit(history, i);
    expect(history.past).toHaveLength(MAX_HISTORY);
  });
});

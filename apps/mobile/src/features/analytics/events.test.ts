import { describe, expect, it } from 'vitest';

import { toErrorEvent, truncate } from './events';

describe('toErrorEvent', () => {
  it('keeps the name and message of an Error', () => {
    expect(toErrorEvent(new RangeError('bad size'), 'camera', false)).toEqual({
      name: 'error',
      context: 'camera',
      errorName: 'RangeError',
      message: 'bad size',
      fatal: false,
    });
  });

  it('scrubs URIs and handles non-errors', () => {
    const event = toErrorEvent('failed at file:///data/user/0/x.jpg', 'album', true);
    expect(event).toMatchObject({ errorName: 'string', message: 'failed at <uri>', fatal: true });
  });
});

describe('truncate', () => {
  it('shortens long text with an ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abc', 4)).toBe('abc');
  });
});

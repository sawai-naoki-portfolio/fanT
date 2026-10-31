import { describe, expect, it } from 'vitest';

import { daysInMonth, stepDate } from './calendar';

describe('stepDate', () => {
  it('wraps months and days', () => {
    expect(stepDate({ year: 2026, month: 12, day: 5 }, 'month', 1)).toEqual({
      year: 2026,
      month: 1,
      day: 5,
    });
    expect(stepDate({ year: 2026, month: 3, day: 1 }, 'day', -1)).toEqual({
      year: 2026,
      month: 3,
      day: 31,
    });
  });

  it('keeps the day valid when the month gets shorter', () => {
    expect(stepDate({ year: 2026, month: 1, day: 31 }, 'month', 1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(stepDate({ year: 2024, month: 2, day: 29 }, 'year', 1)).toEqual({
      year: 2025,
      month: 2,
      day: 28,
    });
  });

  it('knows leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });
});

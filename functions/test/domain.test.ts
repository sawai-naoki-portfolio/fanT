import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  creditsOf,
  debit,
  adjustPurchased,
  InsufficientCreditsError,
  periodOf,
  refund,
  type CreditAccount,
} from '../src/domain/credits';
import { takeRate } from '../src/domain/rate-limit';
import { hashSecret, parseBearer, sameSecret, secretMatches } from '../src/domain/secrets';
import { STYLES } from '../src/domain/styles';

const NOV = Date.parse('2026-11-15T00:00:00Z');
const DEC = Date.parse('2026-12-02T00:00:00Z');
const FREE: CreditAccount = { purchased: 3, monthly: null, subscriberUntil: null };
const SUBSCRIBER: CreditAccount = {
  purchased: 2,
  monthly: null,
  subscriberUntil: Date.parse('2027-11-01T00:00:00Z'),
};

describe('credits', () => {
  it('counts purchased credits, plus the monthly grant while subscribed', () => {
    expect(creditsOf(FREE, NOV, 10)).toEqual({ total: 3, monthly: 0, purchased: 3 });
    expect(creditsOf(SUBSCRIBER, NOV, 10)).toEqual({ total: 12, monthly: 10, purchased: 2 });
  });

  it('uses monthly credits first and resets them each month without carry-over', () => {
    let account = SUBSCRIBER;
    for (let i = 0; i < 10; i++) account = debit(account, 1, NOV, 10).account;
    expect(creditsOf(account, NOV, 10)).toEqual({ total: 2, monthly: 0, purchased: 2 });
    expect(creditsOf(account, DEC, 10)).toEqual({ total: 12, monthly: 10, purchased: 2 });
  });

  it('refuses when there are not enough credits', () => {
    expect(() => debit({ ...FREE, purchased: 0 }, 1, NOV, 10)).toThrow(InsufficientCreditsError);
  });

  it('refunds exactly what was taken', () => {
    const taken = debit(FREE, 1, NOV, 10);
    expect(refund(taken.account, taken.debit).purchased).toBe(3);
    const fromMonthly = debit(SUBSCRIBER, 1, NOV, 10);
    expect(creditsOf(refund(fromMonthly.account, fromMonthly.debit), NOV, 10).monthly).toBe(10);
  });

  it('refunds credits of an ended month as purchased ones', () => {
    const taken = debit(SUBSCRIBER, 1, NOV, 10);
    const nextMonth = debit(taken.account, 1, DEC, 10).account;
    expect(refund(nextMonth, taken.debit).purchased).toBe(3);
  });

  it('grants purchased credits and rejects invalid grants', () => {
    expect(adjustPurchased(FREE, 10).purchased).toBe(13);
    expect(adjustPurchased(FREE, -10).purchased).toBe(0);
    expect(() => adjustPurchased(FREE, 0)).toThrow(RangeError);
    expect(() => adjustPurchased(FREE, 1.5)).toThrow(RangeError);
  });

  it('uses UTC calendar months', () => {
    expect(periodOf(Date.parse('2026-11-30T23:59:59Z'))).toBe('2026-11');
  });
});

describe('takeRate', () => {
  it('allows up to the limit per window', () => {
    let window = takeRate(null, 0, 2, 1000);
    window = window === null ? null : takeRate(window, 10, 2, 1000);
    expect(window?.count).toBe(2);
    expect(window === null ? null : takeRate(window, 20, 2, 1000)).toBeNull();
    expect(window === null ? null : takeRate(window, 1000, 2, 1000)).toEqual({
      start: 1000,
      count: 1,
    });
  });
});

describe('secrets', () => {
  const secret = 'a'.repeat(43);

  it('verifies a secret against its hash only', () => {
    expect(secretMatches(secret, hashSecret(secret))).toBe(true);
    expect(secretMatches('b'.repeat(43), hashSecret(secret))).toBe(false);
  });

  it('parses well-formed bearer credentials only', () => {
    expect(parseBearer(`Bearer ${'0'.repeat(32)}.${secret}`)).toEqual({
      accountId: '0'.repeat(32),
      secret,
    });
    expect(parseBearer(`Bearer ${'0'.repeat(32)}`)).toBeNull();
    expect(parseBearer(undefined)).toBeNull();
  });

  it('compares shared secrets', () => {
    expect(sameSecret('token', 'token')).toBe(true);
    expect(sameSecret('token', 'tokem')).toBe(false);
    expect(sameSecret('token', 'token2')).toBe(false);
  });
});

describe('styles', () => {
  it('match the AI styles offered in content, with the same prices', () => {
    const content = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '..', '..', 'content', 'builtin', 'ai-styles.json'),
        'utf8',
      ),
    ) as { id: string; credits: number }[];
    for (const style of content) expect(STYLES[style.id]?.credits, style.id).toBe(style.credits);
  });
});

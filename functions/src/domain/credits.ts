import type { Credits } from '@fant/api-types';

/** Free credits for a new account (AI-07, 04 §2). */
export const FREE_CREDITS = 3;

export interface MonthlyGrant {
  /** Calendar month in UTC, e.g. "2026-11". */
  readonly period: string;
  readonly remaining: number;
}

export interface CreditAccount {
  /** Purchased and free credits; never expire. */
  readonly purchased: number;
  /** This period's subscriber grant, once touched. */
  readonly monthly: MonthlyGrant | null;
  /** End of the annual subscription that grants monthly credits (ms), if any. */
  readonly subscriberUntil: number | null;
}

/** What one generation took, so a failure can give exactly that back. */
export interface Debit {
  readonly period: string;
  readonly monthly: number;
  readonly purchased: number;
}

export class InsufficientCreditsError extends Error {
  override readonly name = 'InsufficientCreditsError';
}

export function periodOf(time: number): string {
  return new Date(time).toISOString().slice(0, 7);
}

/** Monthly credits usable now: a fresh grant each month while subscribed, no carry-over. */
function monthlyRemaining(account: CreditAccount, now: number, monthlyGrant: number): number {
  if (account.subscriberUntil === null || account.subscriberUntil <= now) return 0;
  const period = periodOf(now);
  return account.monthly?.period === period ? account.monthly.remaining : monthlyGrant;
}

export function creditsOf(account: CreditAccount, now: number, monthlyGrant: number): Credits {
  const monthly = monthlyRemaining(account, now, monthlyGrant);
  return { total: monthly + account.purchased, monthly, purchased: account.purchased };
}

/** Takes `cost` credits, monthly ones first; throws when there are not enough. */
export function debit(
  account: CreditAccount,
  cost: number,
  now: number,
  monthlyGrant: number,
): { readonly account: CreditAccount; readonly debit: Debit } {
  const monthly = monthlyRemaining(account, now, monthlyGrant);
  if (monthly + account.purchased < cost) throw new InsufficientCreditsError('Not enough credits');
  const fromMonthly = Math.min(monthly, cost);
  const fromPurchased = cost - fromMonthly;
  const period = periodOf(now);
  return {
    account: {
      ...account,
      purchased: account.purchased - fromPurchased,
      monthly: { period, remaining: monthly - fromMonthly },
    },
    debit: { period, monthly: fromMonthly, purchased: fromPurchased },
  };
}

/**
 * Gives a failed or cancelled generation's credits back. Monthly credits from a
 * month that has ended come back as purchased ones, so nothing is lost.
 */
export function refund(account: CreditAccount, taken: Debit): CreditAccount {
  const samePeriod = account.monthly?.period === taken.period;
  return {
    ...account,
    purchased: account.purchased + taken.purchased + (samePeriod ? 0 : taken.monthly),
    monthly: samePeriod
      ? { ...account.monthly, remaining: account.monthly.remaining + taken.monthly }
      : account.monthly,
  };
}

/** Adds purchased credits (positive) or takes refunded ones back (negative, never below 0). */
export function adjustPurchased(account: CreditAccount, credits: number): CreditAccount {
  if (!Number.isInteger(credits) || credits === 0)
    throw new RangeError(`Invalid credit change ${String(credits)}`);
  return { ...account, purchased: Math.max(0, account.purchased + credits) };
}

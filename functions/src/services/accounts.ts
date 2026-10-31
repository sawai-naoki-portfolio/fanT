import type { CreateAccountResponse, Credits } from '@fant/api-types';

import { creditsOf, FREE_CREDITS } from '../domain/credits';
import { hashSecret, newId, parseBearer, secretMatches } from '../domain/secrets';
import type { AccountRecord, Dependencies } from '../ports';
import { takeAddressRate } from './address-limit';
import { ApiFailure } from './errors';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Registers a device (SET-04: anonymous, no sign-up) with its own secret and the
 * free credits (AI-07). New accounts are limited per network address, so free
 * credits cannot be farmed by registering again and again.
 */
export async function createAccount(
  deps: Dependencies,
  secret: string,
  address: string,
): Promise<CreateAccountResponse> {
  const now = deps.now();
  const accountId = newId();
  const account: AccountRecord = {
    secretHash: hashSecret(secret),
    createdAt: now,
    purchased: FREE_CREDITS,
    monthly: null,
    subscriberUntil: null,
    rate: null,
  };
  await deps.store.transaction(async (tx) => {
    await takeAddressRate(tx, 'address', address, {
      count: deps.settings.accountsPerAddressPerDay,
      windowMs: DAY_MS,
      now,
    });
    tx.setAccount(accountId, account);
  });
  deps.logger.info('account.created', { accountId });
  return { accountId, credits: creditsOf(account, now, deps.settings.monthlyCredits) };
}

/** The account a request belongs to; rejects anything but a valid device credential. */
export async function authenticate(
  deps: Dependencies,
  authorization: string | undefined,
): Promise<string> {
  const credential = parseBearer(authorization);
  if (credential === null) throw new ApiFailure('unauthorized', 'Missing or malformed credential');
  const account = await deps.store.getAccount(credential.accountId);
  if (account === null || !secretMatches(credential.secret, account.secretHash)) {
    throw new ApiFailure('unauthorized', 'Unknown credential');
  }
  return credential.accountId;
}

export async function getCredits(deps: Dependencies, accountId: string): Promise<Credits> {
  const account = await deps.store.getAccount(accountId);
  if (account === null) throw new ApiFailure('not_found', 'Account not found');
  return creditsOf(account, deps.now(), deps.settings.monthlyCredits);
}

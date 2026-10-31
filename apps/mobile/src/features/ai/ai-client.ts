import {
  apiErrorSchema,
  createAccountResponseSchema,
  creditsResponseSchema,
  generationSchema,
  type Credits,
  type Generation,
  type ReportReason,
} from '@fant/api-types';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { z } from 'zod';

import { APP_CONFIG } from '../../config';
import { toBase64, toBase64Url } from '../../lib/base64';
import { fetchWithTimeout } from '../../lib/fetch-with-timeout';
import { linkPurchasesAccount } from '../purchases/purchases-store';
import { AiError } from './ai-error';

const ACCOUNT_KEY = 'ai.account';
const TIMEOUT_MS = 20_000;

interface StoredAccount {
  readonly accountId: string;
  readonly secret: string;
}

function baseUrl(): string {
  if (APP_CONFIG.apiBaseUrl === null) throw new AiError('unavailable', 'AI is not configured');
  return APP_CONFIG.apiBaseUrl;
}

async function request<T>(
  path: string,
  schema: z.ZodType<T> | null,
  init: {
    readonly method?: string;
    readonly body?: unknown;
    readonly account?: StoredAccount;
  } = {},
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  let status: number;
  let json: unknown;
  try {
    ({ status, json } = await fetchWithTimeout(
      url,
      {
        method: init.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(init.account === undefined
            ? {}
            : { Authorization: `Bearer ${init.account.accountId}.${init.account.secret}` }),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      },
      TIMEOUT_MS,
      async (response) => ({
        status: response.status,
        json:
          response.status === 204 ? null : ((await response.json().catch(() => null)) as unknown),
      }),
    ));
  } catch {
    throw new AiError('offline', 'Network request failed');
  }
  if (status < 200 || status >= 300) {
    const parsed = apiErrorSchema.safeParse(json);
    throw new AiError(
      parsed.success ? parsed.data.error.code : 'internal',
      `HTTP ${String(status)}`,
    );
  }
  if (schema === null) return undefined as T;
  // Responses are validated like any untrusted input.
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AiError('internal', 'Unexpected response');
  return parsed.data;
}

/** The stored account, or `null` when there is none or it cannot be read. */
function parseAccount(stored: string | null): StoredAccount | null {
  if (stored === null) return null;
  try {
    const value: unknown = JSON.parse(stored);
    if (
      typeof value === 'object' &&
      value !== null &&
      'accountId' in value &&
      'secret' in value &&
      typeof value.accountId === 'string' &&
      typeof value.secret === 'string'
    ) {
      return { accountId: value.accountId, secret: value.secret };
    }
  } catch {
    // Unreadable: treated as no account.
  }
  return null;
}

let account: Promise<StoredAccount> | undefined;

async function loadOrCreateAccount(): Promise<StoredAccount> {
  const stored = parseAccount(await SecureStore.getItemAsync(ACCOUNT_KEY));
  if (stored !== null) {
    void linkPurchasesAccount(stored.accountId);
    return stored;
  }
  // The secret never leaves the device except to authenticate; the server keeps a hash.
  const secret = toBase64Url(getRandomBytes(32));
  const created = await request('/v1/accounts', createAccountResponseSchema, {
    method: 'POST',
    body: { secret },
  });
  const next = { accountId: created.accountId, secret };
  await SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify(next));
  // Credit packs bought from now on are credited to this account (PAY-03).
  void linkPurchasesAccount(next.accountId);
  return next;
}

/** The device's anonymous AI account (SET-04), created on first use with the free credits. */
function ensureAccount(): Promise<StoredAccount> {
  account ??= loadOrCreateAccount().catch((error: unknown) => {
    account = undefined;
    throw error;
  });
  return account;
}

export async function fetchCredits(): Promise<Credits> {
  return (await request('/v1/credits', creditsResponseSchema, { account: await ensureAccount() }))
    .credits;
}

/** Starts a style or a tool (AI-10/11); `mask` (PNG) is only for erasing. */
export async function startGeneration(
  styleId: string,
  jpeg: Uint8Array,
  mask?: Uint8Array,
): Promise<Generation> {
  return request('/v1/generations', generationSchema, {
    method: 'POST',
    body: {
      styleId,
      image: toBase64(jpeg),
      ...(mask === undefined ? {} : { mask: toBase64(mask) }),
    },
    account: await ensureAccount(),
  });
}

export async function getGeneration(id: string): Promise<Generation> {
  return request(`/v1/generations/${encodeURIComponent(id)}`, generationSchema, {
    account: await ensureAccount(),
  });
}

export async function cancelGeneration(id: string): Promise<Generation> {
  return request(`/v1/generations/${encodeURIComponent(id)}`, generationSchema, {
    method: 'DELETE',
    account: await ensureAccount(),
  });
}

export async function reportGeneration(id: string, reason: ReportReason): Promise<void> {
  await request(`/v1/generations/${encodeURIComponent(id)}/report`, null, {
    method: 'POST',
    body: { reason },
    account: await ensureAccount(),
  });
}

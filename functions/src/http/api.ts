import {
  createAccountRequestSchema,
  createGenerationRequestSchema,
  eventsRequestSchema,
  reportRequestSchema,
} from '@fant/api-types';
import type { z } from 'zod';

import { sameSecret } from '../domain/secrets';
import type { Dependencies } from '../ports';
import { authenticate, createAccount, getCredits } from '../services/accounts';
import { ApiFailure, HTTP_STATUS } from '../services/errors';
import {
  cancelGeneration,
  createGeneration,
  getGeneration,
  reportGeneration,
} from '../services/generations';
import { recordEvents } from '../services/events';
import { handleRevenueCatEvent } from '../services/webhooks';

export interface ApiRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** Parsed JSON body (the platform enforces the size limit). */
  readonly body: unknown;
  /** The caller's network address, for per-address limits. */
  readonly address: string;
}

export interface ApiResponse {
  readonly status: number;
  readonly body?: unknown;
}

export interface ApiOptions {
  /** Shared secret RevenueCat sends with webhooks. */
  readonly revenueCatWebhookSecret: string;
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiFailure('bad_request', 'Invalid request');
  return result.data;
}

const GENERATION_PATH = /^\/v1\/generations\/([a-f0-9]{32})$/;
const REPORT_PATH = /^\/v1\/generations\/([a-f0-9]{32})\/report$/;

async function route(
  deps: Dependencies,
  options: ApiOptions,
  request: ApiRequest,
): Promise<ApiResponse> {
  const { method, path } = request;
  const authorized = () => authenticate(deps, request.headers.authorization);

  if (method === 'POST' && path === '/v1/accounts') {
    const { secret } = parse(createAccountRequestSchema, request.body);
    return { status: 201, body: await createAccount(deps, secret, request.address) };
  }
  if (method === 'GET' && path === '/v1/credits') {
    return { status: 200, body: { credits: await getCredits(deps, await authorized()) } };
  }
  if (method === 'POST' && path === '/v1/generations') {
    const accountId = await authorized();
    return {
      status: 202,
      body: await createGeneration(
        deps,
        accountId,
        parse(createGenerationRequestSchema, request.body),
      ),
    };
  }
  const generation = GENERATION_PATH.exec(path)?.[1];
  if (generation !== undefined && method === 'GET') {
    return { status: 200, body: await getGeneration(deps, await authorized(), generation) };
  }
  if (generation !== undefined && method === 'DELETE') {
    return { status: 200, body: await cancelGeneration(deps, await authorized(), generation) };
  }
  const reported = REPORT_PATH.exec(path)?.[1];
  if (reported !== undefined && method === 'POST') {
    const { reason } = parse(reportRequestSchema, request.body);
    await reportGeneration(deps, await authorized(), reported, reason);
    return { status: 204 };
  }
  if (method === 'POST' && path === '/v1/events') {
    await recordEvents(deps, parse(eventsRequestSchema, request.body), request.address);
    return { status: 204 };
  }
  if (method === 'POST' && path === '/v1/webhooks/revenuecat') {
    const token = (request.headers.authorization ?? '').replace(/^Bearer /, '');
    if (
      options.revenueCatWebhookSecret === '' ||
      !sameSecret(token, options.revenueCatWebhookSecret)
    ) {
      throw new ApiFailure('unauthorized', 'Invalid webhook credential');
    }
    await handleRevenueCatEvent(deps, request.body);
    return { status: 200, body: { ok: true } };
  }
  throw new ApiFailure('not_found', 'No such endpoint');
}

/**
 * Handles one API request. Known failures become `{ error: { code, message } }`;
 * anything unexpected is logged and reported as `internal` without details.
 */
export async function handleRequest(
  deps: Dependencies,
  options: ApiOptions,
  request: ApiRequest,
): Promise<ApiResponse> {
  try {
    return await route(deps, options, request);
  } catch (error) {
    if (error instanceof ApiFailure) {
      return {
        status: HTTP_STATUS[error.code],
        body: { error: { code: error.code, message: error.message } },
      };
    }
    deps.logger.error('api.unhandled', {
      method: request.method,
      path: request.path,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: 500, body: { error: { code: 'internal', message: 'Something went wrong' } } };
  }
}

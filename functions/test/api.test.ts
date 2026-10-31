import { describe, expect, it } from 'vitest';

import { handleRequest, type ApiRequest } from '../src/http/api';
import { SECRET, testDependencies } from './fakes';

const OPTIONS = { revenueCatWebhookSecret: 'webhook-secret' };

function request(overrides: Partial<ApiRequest>): ApiRequest {
  return {
    method: 'GET',
    path: '/',
    headers: {},
    body: undefined,
    address: '203.0.113.7',
    ...overrides,
  };
}

describe('api', () => {
  it('creates an account and reads credits with its credential', async () => {
    const { deps } = testDependencies();
    const created = await handleRequest(
      deps,
      OPTIONS,
      request({ method: 'POST', path: '/v1/accounts', body: { secret: SECRET } }),
    );
    expect(created.status).toBe(201);
    const { accountId } = created.body as { accountId: string };
    const credits = await handleRequest(
      deps,
      OPTIONS,
      request({ path: '/v1/credits', headers: { authorization: `Bearer ${accountId}.${SECRET}` } }),
    );
    expect(credits).toEqual({
      status: 200,
      body: { credits: { total: 3, monthly: 0, purchased: 3 } },
    });
  });

  it('reports validation, auth and routing failures with codes', async () => {
    const { deps } = testDependencies();
    expect(
      await handleRequest(
        deps,
        OPTIONS,
        request({ method: 'POST', path: '/v1/accounts', body: { secret: 'short' } }),
      ),
    ).toMatchObject({
      status: 400,
      body: { error: { code: 'bad_request' } },
    });
    expect(await handleRequest(deps, OPTIONS, request({ path: '/v1/credits' }))).toMatchObject({
      status: 401,
    });
    expect(await handleRequest(deps, OPTIONS, request({ path: '/v1/unknown' }))).toMatchObject({
      status: 404,
    });
  });

  it('requires the webhook secret', async () => {
    const { deps } = testDependencies();
    const webhook = { method: 'POST', path: '/v1/webhooks/revenuecat', body: {} };
    expect(
      await handleRequest(
        deps,
        OPTIONS,
        request({ ...webhook, headers: { authorization: 'Bearer wrong' } }),
      ),
    ).toMatchObject({ status: 401 });
    expect(
      await handleRequest(
        deps,
        OPTIONS,
        request({ ...webhook, headers: { authorization: 'Bearer webhook-secret' } }),
      ),
    ).toMatchObject({ status: 200 });
    expect(
      await handleRequest(
        deps,
        { revenueCatWebhookSecret: '' },
        request({ ...webhook, headers: { authorization: 'Bearer ' } }),
      ),
    ).toMatchObject({ status: 401 });
  });

  const events = request({
    method: 'POST',
    path: '/v1/events',
    body: {
      installId: '0b5e3f9a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
      platform: 'ios',
      appVersion: '0.1.0',
      events: [{ event: { name: 'app_open' }, at: 1 }],
    },
  });

  it('logs analytics events without storing them', async () => {
    const { deps, logs } = testDependencies();
    const response = await handleRequest(deps, OPTIONS, events);
    expect(response.status).toBe(204);
    expect(logs.filter(({ message }) => message === 'analytics.event')).toHaveLength(1);
  });

  it('limits analytics batches per network address', async () => {
    const { deps } = testDependencies();
    // The test settings allow two batches per hour.
    await handleRequest(deps, OPTIONS, events);
    await handleRequest(deps, OPTIONS, events);
    expect(await handleRequest(deps, OPTIONS, events)).toMatchObject({ status: 429 });
    expect(
      await handleRequest(deps, OPTIONS, { ...events, address: '198.51.100.1' }),
    ).toMatchObject({ status: 204 });
  });

  it('hides unexpected errors', async () => {
    const { deps, logs } = testDependencies();
    const broken = {
      ...deps,
      store: { ...deps.store, transaction: () => Promise.reject(new Error('db down')) },
    };
    const response = await handleRequest(
      broken,
      OPTIONS,
      request({ method: 'POST', path: '/v1/accounts', body: { secret: SECRET } }),
    );
    expect(response).toEqual({
      status: 500,
      body: { error: { code: 'internal', message: 'Something went wrong' } },
    });
    expect(logs.some(({ level }) => level === 'error')).toBe(true);
  });
});

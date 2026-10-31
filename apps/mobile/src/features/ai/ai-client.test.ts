import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const linkPurchasesAccount = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../purchases/purchases-store', () => ({ linkPurchasesAccount }));

const ACCOUNT_ID = 'abcdefghij0123456789';
const CREDITS = { total: 3, monthly: 0, purchased: 3 };

interface SentRequest {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | null;
  readonly body: unknown;
}

/** A fake API: each handler answers one `METHOD /path`; every request is recorded. */
function serve(handlers: Record<string, () => Response | Promise<Response>>) {
  const sent: SentRequest[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const path = url.replace('https://api.example.com', '');
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    sent.push({
      method,
      path,
      authorization: headers.get('Authorization'),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const handler = handlers[`${method} ${path}`];
    if (handler === undefined)
      return Response.json({ error: { code: 'not_found' } }, { status: 404 });
    return handler();
  });
  return sent;
}

const createAccount = () =>
  Response.json({ accountId: ACCOUNT_ID, credits: CREDITS }, { status: 201 });
const credits = () => Response.json({ credits: CREDITS });

/** A fresh module, so the cached account of one test does not leak into the next. */
async function load() {
  vi.resetModules();
  const client = await import('./ai-client');
  const { AiError } = await import('./ai-error');
  const { APP_CONFIG } = await import('../../config');
  const secureStore = await import('expo-secure-store');
  return { client, AiError, APP_CONFIG, secureStore };
}

describe('ai-client', () => {
  beforeEach(() => {
    linkPurchasesAccount.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates an account on first use and keeps it in the secure store', async () => {
    const { client, secureStore } = await load();
    const sent = serve({ 'POST /v1/accounts': createAccount, 'GET /v1/credits': credits });

    await expect(client.fetchCredits()).resolves.toEqual(CREDITS);
    await client.fetchCredits();

    expect(sent.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /v1/accounts',
      'GET /v1/credits',
      'GET /v1/credits',
    ]);
    const { secret } = sent[0]?.body as { secret: string };
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sent[1]?.authorization).toBe(`Bearer ${ACCOUNT_ID}.${secret}`);
    expect(JSON.parse((await secureStore.getItemAsync('ai.account')) ?? '')).toEqual({
      accountId: ACCOUNT_ID,
      secret,
    });
    expect(linkPurchasesAccount).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it('creates one account when several requests start together', async () => {
    const { client } = await load();
    const sent = serve({ 'POST /v1/accounts': createAccount, 'GET /v1/credits': credits });

    await Promise.all([client.fetchCredits(), client.fetchCredits()]);

    expect(sent.filter(({ path }) => path === '/v1/accounts')).toHaveLength(1);
  });

  it('uses the stored account', async () => {
    const { client, secureStore } = await load();
    await secureStore.setItemAsync(
      'ai.account',
      JSON.stringify({ accountId: 'stored', secret: 's' }),
    );
    const sent = serve({ 'GET /v1/credits': credits });

    await client.fetchCredits();

    expect(sent).toEqual([expect.objectContaining({ authorization: 'Bearer stored.s' })]);
    expect(linkPurchasesAccount).toHaveBeenCalledWith('stored');
  });

  it('replaces an unreadable stored account with a new one', async () => {
    const { client, secureStore } = await load();
    await secureStore.setItemAsync('ai.account', '{not json');
    const sent = serve({ 'POST /v1/accounts': createAccount, 'GET /v1/credits': credits });

    await client.fetchCredits();

    expect(sent[0]?.path).toBe('/v1/accounts');
  });

  it('tries to create the account again after a failure', async () => {
    const { client } = await load();
    let fail = true;
    serve({
      'POST /v1/accounts': () =>
        fail
          ? Response.json(
              { error: { code: 'rate_limited', message: 'Slow down' } },
              { status: 429 },
            )
          : createAccount(),
      'GET /v1/credits': credits,
    });

    await expect(client.fetchCredits()).rejects.toMatchObject({ code: 'rate_limited' });
    fail = false;
    await expect(client.fetchCredits()).resolves.toEqual(CREDITS);
  });

  it('turns server errors into their code, and anything unreadable into internal', async () => {
    const { client, secureStore } = await load();
    await secureStore.setItemAsync('ai.account', JSON.stringify({ accountId: 'a', secret: 's' }));
    serve({
      'GET /v1/generations/known': () =>
        Response.json(
          { error: { code: 'insufficient_credits', message: 'No credits' } },
          { status: 402 },
        ),
      'GET /v1/generations/garbled': () => new Response('<html>', { status: 502 }),
      'GET /v1/generations/odd': () => Response.json({ id: 'odd' }),
    });

    await expect(client.getGeneration('known')).rejects.toMatchObject({
      code: 'insufficient_credits',
    });
    await expect(client.getGeneration('garbled')).rejects.toMatchObject({ code: 'internal' });
    // A 200 that does not match the schema is not trusted either.
    await expect(client.getGeneration('odd')).rejects.toMatchObject({ code: 'internal' });
  });

  it('reports a network failure as offline', async () => {
    const { client, AiError, secureStore } = await load();
    await secureStore.setItemAsync('ai.account', JSON.stringify({ accountId: 'a', secret: 's' }));
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Network request failed')));

    const error: unknown = await client.fetchCredits().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ code: 'offline' });
  });

  it('is unavailable without a server', async () => {
    const { client, APP_CONFIG } = await load();
    const { apiBaseUrl } = APP_CONFIG;
    Object.assign(APP_CONFIG, { apiBaseUrl: null });
    try {
      await expect(client.fetchCredits()).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      Object.assign(APP_CONFIG, { apiBaseUrl });
    }
  });

  it('sends the photo and mask as base64 and escapes generation IDs', async () => {
    const { client, secureStore } = await load();
    await secureStore.setItemAsync('ai.account', JSON.stringify({ accountId: 'a', secret: 's' }));
    const generation = {
      id: 'g/1',
      status: 'queued',
      imageUrl: null,
      error: null,
      credits: CREDITS,
    };
    const sent = serve({
      'POST /v1/generations': () => Response.json(generation, { status: 202 }),
      'DELETE /v1/generations/g%2F1': () => Response.json({ ...generation, status: 'cancelled' }),
      'POST /v1/generations/g%2F1/report': () => new Response(null, { status: 204 }),
    });

    await client.startGeneration('erase', new Uint8Array([1, 2, 3]), new Uint8Array([255]));
    await client.cancelGeneration('g/1');
    await client.reportGeneration('g/1', 'other');

    expect(sent.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      {
        method: 'POST',
        path: '/v1/generations',
        body: { styleId: 'erase', image: 'AQID', mask: '/w==' },
      },
      { method: 'DELETE', path: '/v1/generations/g%2F1', body: undefined },
      { method: 'POST', path: '/v1/generations/g%2F1/report', body: { reason: 'other' } },
    ]);
  });
});

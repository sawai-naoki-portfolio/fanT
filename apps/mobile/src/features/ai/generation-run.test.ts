import type { Generation } from '@fant/api-types';
import { describe, expect, it, vi } from 'vitest';

import { DownloadError } from '../../lib/download-file';
import { AiError } from './ai-error';
import { GenerationRun, type GenerationDeps, type GenerationState } from './generation-run';

const CREDITS = { total: 4, monthly: 0, purchased: 4 };

function generation(patch: Partial<Generation> = {}): Generation {
  return {
    id: 'gen1',
    status: 'queued',
    imageUrl: null,
    error: null,
    credits: CREDITS,
    ...patch,
  };
}

const SUCCEEDED = generation({ status: 'succeeded', imageUrl: 'https://example.com/r.jpg' });

/** A promise the test settles by hand, to stop a run at a chosen step. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup(overrides: Partial<GenerationDeps> = {}) {
  let clock = 0;
  const deps = {
    start: vi.fn(() => Promise.resolve(generation())),
    get: vi.fn(() => Promise.resolve(SUCCEEDED)),
    cancel: vi.fn(() => Promise.resolve(generation({ status: 'cancelled' }))),
    download: vi.fn(() => Promise.resolve('file:///result.jpg')),
    setCredits: vi.fn(),
    onSucceeded: vi.fn(),
    reportError: vi.fn(),
    sleep: vi.fn((ms: number) => {
      clock += ms;
      return Promise.resolve();
    }),
    now: () => clock,
    giveUpMs: 120_000,
    ...overrides,
  } satisfies GenerationDeps;
  const states: GenerationState[] = [];
  const run = new GenerationRun(deps, (state) => states.push(state));
  return { deps, run, states };
}

describe('GenerationRun', () => {
  it('polls until the generation succeeds, then downloads the result', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(generation({ status: 'processing' }))
      .mockResolvedValueOnce(SUCCEEDED);
    const { deps, run, states } = setup({ get });

    await run.run();

    expect(get).toHaveBeenCalledTimes(2);
    expect(deps.download).toHaveBeenCalledWith('gen1', 'https://example.com/r.jpg');
    expect(deps.onSucceeded).toHaveBeenCalledOnce();
    expect(states).toEqual([
      { phase: 'running', id: 'gen1' },
      { phase: 'done', id: 'gen1', resultUri: 'file:///result.jpg' },
    ]);
  });

  it('updates the credits when the generation starts and when it ends', async () => {
    const after = { total: 3, monthly: 0, purchased: 3 };
    const setCredits = vi.fn();
    const { run } = setup({
      get: vi.fn(() => Promise.resolve({ ...SUCCEEDED, credits: after })),
      setCredits,
    });

    await run.run();

    expect(setCredits.mock.calls).toEqual([[CREDITS], [after]]);
  });

  it('keeps polling through a dropped connection', async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(new AiError('offline', 'Network request failed'))
      .mockResolvedValueOnce(SUCCEEDED);
    const { run, states } = setup({ get });

    await run.run();

    expect(states.at(-1)).toMatchObject({ phase: 'done' });
  });

  it('reports the server’s reason when the generation fails', async () => {
    const { run, states } = setup({
      get: vi.fn(() =>
        Promise.resolve(generation({ status: 'failed', error: 'moderation_blocked' })),
      ),
    });

    await run.run();

    expect(states.at(-1)).toEqual({ phase: 'failed', code: 'moderation_blocked' });
  });

  it('gives up after two minutes', async () => {
    const { run, states } = setup({
      get: vi.fn(() => Promise.resolve(generation({ status: 'processing' }))),
    });

    await run.run();

    expect(states.at(-1)).toEqual({ phase: 'failed', code: 'timeout' });
  });

  it('shows a failed download as offline', async () => {
    const { run, states } = setup({
      download: vi.fn(() => Promise.reject(new DownloadError('Download failed'))),
    });

    await run.run();

    expect(states.at(-1)).toEqual({ phase: 'failed', code: 'offline' });
  });

  it('reports an unexpected error and shows it as internal', async () => {
    const error = new Error('boom');
    const { deps, run, states } = setup({ start: vi.fn(() => Promise.reject(error)) });

    await run.run();

    expect(deps.reportError).toHaveBeenCalledWith(error, 'ai.generate');
    expect(states).toEqual([{ phase: 'failed', code: 'internal' }]);
  });

  it('cancels on the server and refunds the credit while polling', async () => {
    const refunded = { total: 5, monthly: 0, purchased: 5 };
    const poll = deferred<Generation>();
    const { deps, run, states } = setup({
      get: vi.fn(() => poll.promise),
      cancel: vi.fn(() => Promise.resolve(generation({ status: 'cancelled', credits: refunded }))),
    });

    const running = run.run();
    await vi.waitFor(() => {
      expect(deps.get).toHaveBeenCalled();
    });
    await run.cancel();
    poll.resolve(SUCCEEDED);
    await running;

    expect(deps.cancel).toHaveBeenCalledWith('gen1');
    expect(deps.setCredits).toHaveBeenLastCalledWith(refunded);
    expect(deps.download).not.toHaveBeenCalled();
    expect(states.at(-1)).toEqual({ phase: 'cancelled' });
  });

  it('cancels on the server when cancelled during the upload', async () => {
    const started = deferred<Generation>();
    const { deps, run, states } = setup({ start: vi.fn(() => started.promise) });

    const running = run.run();
    await run.cancel();
    expect(deps.cancel).not.toHaveBeenCalled();
    started.resolve(generation());
    await running;

    expect(deps.cancel).toHaveBeenCalledExactlyOnceWith('gen1');
    expect(deps.get).not.toHaveBeenCalled();
    expect(states).toEqual([{ phase: 'cancelled' }]);
  });

  it('cancels only once when pressed twice', async () => {
    const poll = deferred<Generation>();
    const { deps, run } = setup({ get: vi.fn(() => poll.promise) });

    const running = run.run();
    await vi.waitFor(() => {
      expect(deps.get).toHaveBeenCalled();
    });
    await Promise.all([run.cancel(), run.cancel()]);
    poll.resolve(SUCCEEDED);
    await running;

    expect(deps.cancel).toHaveBeenCalledOnce();
  });

  it('keeps cancelled when the server cannot be reached', async () => {
    const poll = deferred<Generation>();
    const error = new AiError('offline', 'Network request failed');
    const { deps, run, states } = setup({
      get: vi.fn(() => poll.promise),
      cancel: vi.fn(() => Promise.reject(error)),
    });

    const running = run.run();
    await vi.waitFor(() => {
      expect(deps.get).toHaveBeenCalled();
    });
    await run.cancel();
    poll.resolve(SUCCEEDED);
    await running;

    expect(deps.reportError).toHaveBeenCalledWith(error, 'ai.cancel');
    expect(states.at(-1)).toEqual({ phase: 'cancelled' });
  });

  it('stops reporting after the screen goes away, without cancelling', async () => {
    const poll = deferred<Generation>();
    const { deps, run, states } = setup({ get: vi.fn(() => poll.promise) });

    const running = run.run();
    await vi.waitFor(() => {
      expect(deps.get).toHaveBeenCalled();
    });
    run.detach();
    poll.resolve(SUCCEEDED);
    await running;

    expect(deps.cancel).not.toHaveBeenCalled();
    expect(deps.download).not.toHaveBeenCalled();
    expect(states).toEqual([{ phase: 'running', id: 'gen1' }]);
  });

  it('carries on when the screen comes back (strict mode remount)', async () => {
    const poll = deferred<Generation>();
    const { deps, run, states } = setup({ get: vi.fn(() => poll.promise) });

    const running = run.run();
    run.detach();
    run.attach();
    poll.resolve(SUCCEEDED);
    await running;

    expect(deps.start).toHaveBeenCalledOnce();
    expect(states.at(-1)).toMatchObject({ phase: 'done' });
  });
});

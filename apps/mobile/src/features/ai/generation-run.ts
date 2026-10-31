import type { ApiErrorCode, Credits, Generation } from '@fant/api-types';

import { DownloadError } from '../../lib/download-file';
import { AiError } from './ai-error';

const POLL_MS = 2000;

export type GenerationState =
  | { readonly phase: 'running'; readonly id: string | null }
  | { readonly phase: 'done'; readonly id: string; readonly resultUri: string }
  | { readonly phase: 'failed'; readonly code: ApiErrorCode | 'offline' }
  | { readonly phase: 'cancelled' };

/** What a run talks to: the AI API and the device, so it can be tested without them. */
export interface GenerationDeps {
  readonly start: () => Promise<Generation>;
  readonly get: (id: string) => Promise<Generation>;
  readonly cancel: (id: string) => Promise<Generation>;
  /** Downloads a succeeded generation's image; returns its local URI. */
  readonly download: (id: string, imageUrl: string) => Promise<string>;
  readonly setCredits: (credits: Credits) => void;
  readonly onSucceeded: () => void;
  readonly reportError: (error: unknown, context: string) => void;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
  /** When to stop waiting: a little after the server's own time limit, which refunds. */
  readonly giveUpMs: number;
}

/** What to tell the user about an error that ended a generation. */
function failureCode(error: unknown, deps: GenerationDeps): ApiErrorCode | 'offline' {
  if (error instanceof AiError) return error.code;
  if (error instanceof DownloadError) return 'offline';
  deps.reportError(error, 'ai.generate');
  return 'internal';
}

/**
 * One generation (S-43): starts it, polls until it ends, then downloads the result.
 * Cancelling refunds the credit on the server, also when it is pressed while the
 * upload is still in flight: the generation is then cancelled as soon as it has an ID.
 */
export class GenerationRun {
  private id: string | null = null;
  private cancelled = false;
  /** The screen went away: stop polling and reporting, but leave the server alone. */
  private detached = false;

  constructor(
    private readonly deps: GenerationDeps,
    private readonly onState: (state: GenerationState) => void,
  ) {}

  /** Reconnects a run whose screen came back (e.g. React strict mode remounting it). */
  attach(): void {
    this.detached = false;
  }

  detach(): void {
    this.detached = true;
  }

  private get stopped(): boolean {
    return this.detached || this.cancelled;
  }

  private finish(state: GenerationState): void {
    if (!this.stopped) this.onState(state);
  }

  /**
   * One status check. A dropped connection keeps the last known state, so a short
   * network blip does not end a generation that is still running (and paid for).
   */
  private async pollOnce(last: Generation): Promise<Generation> {
    try {
      return await this.deps.get(last.id);
    } catch (error) {
      if (error instanceof AiError && error.code === 'offline') return last;
      throw error;
    }
  }

  async run(): Promise<void> {
    const { deps } = this;
    try {
      let generation = await deps.start();
      this.id = generation.id;
      deps.setCredits(generation.credits);
      if (this.cancelled) {
        // Cancelled during the upload: `cancel` had no ID to send yet.
        await this.cancelOnServer(generation.id);
        return;
      }
      this.finish({ phase: 'running', id: generation.id });
      const startedAt = deps.now();
      while (generation.status === 'queued' || generation.status === 'processing') {
        if (this.stopped) return;
        if (deps.now() - startedAt > deps.giveUpMs) throw new AiError('timeout', 'Gave up waiting');
        await deps.sleep(POLL_MS);
        generation = await this.pollOnce(generation);
      }
      if (this.stopped) return;
      deps.setCredits(generation.credits);
      if (generation.status === 'succeeded' && generation.imageUrl !== null) {
        const resultUri = await deps.download(generation.id, generation.imageUrl);
        deps.onSucceeded();
        this.finish({ phase: 'done', id: generation.id, resultUri });
      } else if (generation.status === 'cancelled') {
        this.finish({ phase: 'cancelled' });
      } else {
        this.finish({ phase: 'failed', code: generation.error ?? 'internal' });
      }
    } catch (error) {
      if (!this.stopped) this.finish({ phase: 'failed', code: failureCode(error, deps) });
    }
  }

  async cancel(): Promise<void> {
    if (this.cancelled) return;
    this.onState({ phase: 'cancelled' });
    this.cancelled = true;
    // Without an ID the upload is still in flight, and `run` cancels once it ends.
    if (this.id !== null) await this.cancelOnServer(this.id);
  }

  private async cancelOnServer(id: string): Promise<void> {
    try {
      this.deps.setCredits((await this.deps.cancel(id)).credits);
    } catch (error) {
      this.deps.reportError(error, 'ai.cancel');
    }
  }
}

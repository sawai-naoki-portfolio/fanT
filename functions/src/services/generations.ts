import {
  MAX_MASK_BYTES,
  MAX_UPLOAD_BYTES,
  type ApiErrorCode,
  type Generation,
  type ReportReason,
} from '@fant/api-types';

import { creditsOf, debit, InsufficientCreditsError, refund } from '../domain/credits';
import { jpegSize } from '../domain/jpeg-size';
import { takeRate } from '../domain/rate-limit';
import { newId } from '../domain/secrets';
import { jobFor, SAFETY_PROMPT, type JobDefinition } from '../domain/styles';
import {
  ContentBlockedError,
  type Dependencies,
  type GenerationRecord,
  type Transaction,
} from '../ports';
import { ApiFailure } from './errors';

const HOUR_MS = 60 * 60 * 1000;
/** Results and uploads are deleted within this time (03 §6). */
export const RETENTION_MS = 24 * HOUR_MS;

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  return bytes.length > PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

/** The mask of a masked tool (AI-10, AI-13), which only those take. */
function maskOf(job: JobDefinition, mask: string | undefined): Buffer | null {
  if (job.kind !== 'inpaint') {
    if (mask !== undefined) throw new ApiFailure('bad_request', 'Only masked tools take a mask');
    return null;
  }
  if (mask === undefined) throw new ApiFailure('bad_request', 'This tool needs a mask');
  const bytes = Buffer.from(mask, 'base64');
  if (bytes.length > MAX_MASK_BYTES || !isPng(bytes))
    throw new ApiFailure('bad_request', 'Expected a PNG mask');
  return bytes;
}

/** Does the job's work on a moderated input: a style, a masked repaint, upscaling or a video. */
async function runJob(
  deps: Dependencies,
  id: string,
  job: JobDefinition,
  input: Uint8Array,
  signal: AbortSignal,
): Promise<Uint8Array> {
  switch (job.kind) {
    case 'style':
      return deps.generator.generate(input, `${job.prompt}\n${SAFETY_PROMPT}`, signal);
    case 'inpaint':
      return deps.generator.generate(
        input,
        `${job.prompt}\n${SAFETY_PROMPT}`,
        signal,
        await deps.images.getMask(id),
      );
    case 'upscale':
      return deps.upscaler.upscale(input, signal);
    case 'video': {
      const size = jpegSize(input);
      const shape = size !== null && size.height > size.width ? 'portrait' : 'landscape';
      return deps.videoGenerator.animate(input, `${job.prompt}\n${SAFETY_PROMPT}`, shape, signal);
    }
  }
}

async function view(
  deps: Dependencies,
  id: string,
  generation: GenerationRecord,
): Promise<Generation> {
  const account = await deps.store.getAccount(generation.accountId);
  return {
    id,
    status: generation.status,
    imageUrl: generation.status === 'succeeded' ? await deps.images.outputUrl(id) : null,
    error: generation.error,
    credits:
      account === null
        ? { total: 0, monthly: 0, purchased: 0 }
        : creditsOf(account, deps.now(), deps.settings.monthlyCredits),
  };
}

/**
 * Starts a generation (AI-04): checks the style and the upload, limits the rate,
 * takes the credits and queues the job, all or nothing. Tools (AI-10/11) are
 * started the same way, by ID. The upload is stored first
 * and deleted again if the job cannot start.
 */
export async function createGeneration(
  deps: Dependencies,
  accountId: string,
  request: { readonly styleId: string; readonly image: string; readonly mask?: string },
): Promise<Generation> {
  const style = jobFor(request.styleId);
  if (style === undefined) throw new ApiFailure('bad_request', 'Unknown style');
  const bytes = Buffer.from(request.image, 'base64');
  if (bytes.length > MAX_UPLOAD_BYTES || !isJpeg(bytes))
    throw new ApiFailure('bad_request', 'Expected a JPEG photo');
  const mask = maskOf(style, request.mask);

  const id = newId();
  const now = deps.now();
  try {
    await deps.images.putInput(id, bytes);
    if (mask !== null) await deps.images.putMask(id, mask);
    await deps.store.transaction(async (tx) => {
      const account = await tx.getAccount(accountId);
      if (account === null) throw new ApiFailure('unauthorized', 'Unknown account');
      const rate = takeRate(account.rate, now, deps.settings.generationsPerHour, HOUR_MS);
      if (rate === null)
        throw new ApiFailure('rate_limited', 'Too many generations; try again later');
      let taken: ReturnType<typeof debit>;
      try {
        taken = debit(account, style.credits, now, deps.settings.monthlyCredits);
      } catch (error) {
        if (error instanceof InsufficientCreditsError)
          throw new ApiFailure('insufficient_credits', 'Not enough credits');
        throw error;
      }
      tx.setAccount(accountId, { ...account, ...taken.account, rate });
      tx.setGeneration(id, {
        accountId,
        styleId: request.styleId,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
        debit: taken.debit,
        error: null,
        report: null,
      });
    });
  } catch (error) {
    await deps.images.deleteImages(id);
    throw error;
  }
  deps.logger.info('generation.queued', { id, accountId, styleId: request.styleId });
  const created = await deps.store.getGeneration(id);
  if (created === null) throw new ApiFailure('internal', 'Generation was not saved');
  return view(deps, id, created);
}

/** Ends a job as failed and gives its credits back, unless it already ended. */
async function finishWithRefund(
  tx: Transaction,
  id: string,
  status: 'failed' | 'cancelled',
  error: ApiErrorCode | null,
  now: number,
) {
  const generation = await tx.getGeneration(id);
  if (generation === null || (generation.status !== 'queued' && generation.status !== 'processing'))
    return false;
  const account = await tx.getAccount(generation.accountId);
  if (account !== null)
    tx.setAccount(generation.accountId, { ...account, ...refund(account, generation.debit) });
  tx.setGeneration(id, { ...generation, status, error, updatedAt: now });
  return true;
}

function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, ms);
  return work(controller.signal).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Runs a queued job (triggered when it is created): moderates the upload, generates,
 * moderates the result and stores it. Any failure refunds the credits; the upload is
 * deleted as soon as it is no longer needed (03 §6).
 */
export async function processGeneration(deps: Dependencies, id: string): Promise<void> {
  const started = await deps.store.transaction(async (tx) => {
    const generation = await tx.getGeneration(id);
    if (generation?.status !== 'queued') return null;
    tx.setGeneration(id, { ...generation, status: 'processing', updatedAt: deps.now() });
    return generation;
  });
  if (started === null) return;
  const job = jobFor(started.styleId);

  const fail = async (error: ApiErrorCode) => {
    await deps.store.transaction((tx) => finishWithRefund(tx, id, 'failed', error, deps.now()));
    await deps.images.deleteImages(id);
    deps.logger.warn('generation.failed', { id, error });
  };

  try {
    if (job === undefined) {
      await fail('bad_request');
      return;
    }
    const input = await deps.images.getInput(id);
    const isVideo = job.kind === 'video';
    const timeoutMs = isVideo ? deps.settings.videoTimeoutMs : deps.settings.generationTimeoutMs;
    const output = await withTimeout(async (signal) => {
      if (!(await deps.moderator.isAllowed(input, signal))) return 'blocked' as const;
      const generated = await runJob(deps, id, job, input, signal);
      // Image moderation cannot judge a video: the provider's filters do (see VideoGenerator).
      if (isVideo) return generated;
      return (await deps.moderator.isAllowed(generated, signal)) ? generated : ('blocked' as const);
    }, timeoutMs).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return 'timeout' as const;
      // The provider's own safety filters count like our moderation.
      if (error instanceof ContentBlockedError) return 'blocked' as const;
      throw error;
    });
    if (output === 'blocked') {
      await fail('moderation_blocked');
      return;
    }
    if (output === 'timeout') {
      await fail('timeout');
      return;
    }
    await deps.images.putOutput(id, output);
    const succeeded = await deps.store.transaction(async (tx) => {
      const generation = await tx.getGeneration(id);
      // Cancelled meanwhile: the credits were already refunded; drop the result.
      if (generation?.status !== 'processing') return false;
      tx.setGeneration(id, { ...generation, status: 'succeeded', updatedAt: deps.now() });
      return true;
    });
    if (!succeeded) await deps.images.deleteImages(id);
    deps.logger.info('generation.finished', { id, succeeded });
  } catch (error) {
    deps.logger.error('generation.error', {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    await fail('unavailable');
  }
}

async function owned(deps: Dependencies, accountId: string, id: string): Promise<GenerationRecord> {
  const generation = await deps.store.getGeneration(id);
  // Someone else's job looks exactly like a missing one.
  if (generation?.accountId !== accountId)
    throw new ApiFailure('not_found', 'Generation not found');
  return generation;
}

export async function getGeneration(
  deps: Dependencies,
  accountId: string,
  id: string,
): Promise<Generation> {
  return view(deps, id, await owned(deps, accountId, id));
}

/** Cancels a job that has not finished and refunds it (S-43). */
export async function cancelGeneration(
  deps: Dependencies,
  accountId: string,
  id: string,
): Promise<Generation> {
  await owned(deps, accountId, id);
  const cancelled = await deps.store.transaction((tx) =>
    finishWithRefund(tx, id, 'cancelled', null, deps.now()),
  );
  if (cancelled) await deps.images.deleteImages(id);
  return getGeneration(deps, accountId, id);
}

/** Records a report of an inappropriate result for review (AI-05). */
export async function reportGeneration(
  deps: Dependencies,
  accountId: string,
  id: string,
  reason: ReportReason,
): Promise<void> {
  await owned(deps, accountId, id);
  await deps.store.transaction(async (tx) => {
    const generation = await tx.getGeneration(id);
    if (generation !== null)
      tx.setGeneration(id, { ...generation, report: reason, updatedAt: deps.now() });
  });
  deps.logger.warn('generation.reported', {
    id,
    styleId: (await deps.store.getGeneration(id))?.styleId,
    reason,
  });
}

const DELETE_BATCH = 500;
/** Keeps one run well inside the scheduler's time limit; the next run continues. */
const MAX_DELETE_BATCHES = 10;

/** Deletes jobs, uploads and results older than the retention (03 §6). */
export async function deleteExpiredGenerations(deps: Dependencies): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_DELETE_BATCHES; batch++) {
    const ids = await deps.store.listGenerationsBefore(deps.now() - RETENTION_MS, DELETE_BATCH);
    for (const id of ids) {
      await deps.images.deleteImages(id);
      await deps.store.deleteGeneration(id);
    }
    deleted += ids.length;
    if (ids.length < DELETE_BATCH) break;
  }
  return deleted;
}

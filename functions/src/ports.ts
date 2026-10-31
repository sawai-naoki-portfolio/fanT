import type { ApiErrorCode, GenerationStatus, ReportReason } from '@fant/api-types';

import type { CreditAccount, Debit } from './domain/credits';
import type { RateWindow } from './domain/rate-limit';

/**
 * What the services need from the outside world. Firebase implements these in
 * production; tests use in-memory fakes, so the rules are tested without a cloud.
 */
export interface AccountRecord extends CreditAccount {
  readonly secretHash: string;
  readonly createdAt: number;
  /** Generations started in the current window (03 §5). */
  readonly rate: RateWindow | null;
}

export interface GenerationRecord {
  readonly accountId: string;
  readonly styleId: string;
  readonly status: GenerationStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** Credits taken, given back on any failure (AI-04). */
  readonly debit: Debit;
  readonly error: ApiErrorCode | null;
  readonly report: ReportReason | null;
}

/** Reads and writes that commit together or not at all. */
export interface Transaction {
  getAccount(id: string): Promise<AccountRecord | null>;
  setAccount(id: string, account: AccountRecord): void;
  getGeneration(id: string): Promise<GenerationRecord | null>;
  setGeneration(id: string, generation: GenerationRecord): void;
  getRate(key: string): Promise<RateWindow | null>;
  setRate(key: string, window: RateWindow): void;
  /** Whether a webhook event was already applied; marks it applied. */
  claimEvent(id: string): Promise<boolean>;
}

export interface Store {
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  getAccount(id: string): Promise<AccountRecord | null>;
  getGeneration(id: string): Promise<GenerationRecord | null>;
  /** Generations created before `time`, for deletion (03 §6: within 24 hours). */
  listGenerationsBefore(time: number, limit: number): Promise<string[]>;
  deleteGeneration(id: string): Promise<void>;
}

/** Uploaded photos and results; never kept longer than the generation (03 §6). */
export interface ImageStore {
  putInput(id: string, jpeg: Uint8Array): Promise<void>;
  getInput(id: string): Promise<Uint8Array>;
  /** A masked tool's mask (AI-10, AI-13), kept and deleted with the upload. */
  putMask(id: string, png: Uint8Array): Promise<void>;
  getMask(id: string): Promise<Uint8Array>;
  /** The result: an image, or an MP4 for video tools (AI-14). */
  putOutput(id: string, result: Uint8Array): Promise<void>;
  /** A short-lived HTTPS link to the result. */
  outputUrl(id: string): Promise<string>;
  deleteImages(id: string): Promise<void>;
}

/** The provider refused the request or its result on safety grounds (AI-05). */
export class ContentBlockedError extends Error {
  override readonly name = 'ContentBlockedError';
}

/**
 * The image generation provider (Q-04); prompts are added by the server. Throws
 * `ContentBlockedError` when the provider's own safety checks refuse.
 */
export interface ImageGenerator {
  /** `mask` (PNG, white = the area to change) is passed as a second image when given. */
  generate(
    image: Uint8Array,
    prompt: string,
    signal: AbortSignal,
    mask?: Uint8Array,
  ): Promise<Uint8Array>;
}

/** Which way up a generated video is. */
export type VideoShape = 'portrait' | 'landscape';

/**
 * Turns a photo into a short MP4 (AI-14). Throws `ContentBlockedError` when the
 * provider's safety filters refuse, which is also how its result is moderated:
 * image moderation cannot judge a video.
 */
export interface VideoGenerator {
  animate(
    image: Uint8Array,
    prompt: string,
    shape: VideoShape,
    signal: AbortSignal,
  ): Promise<Uint8Array>;
}

/** Doubles a photo's resolution (AI-11). */
export interface ImageUpscaler {
  upscale(image: Uint8Array, signal: AbortSignal): Promise<Uint8Array>;
}

/** Image moderation for uploads and results (AI-05). */
export interface Moderator {
  isAllowed(image: Uint8Array, signal: AbortSignal): Promise<boolean>;
}

/** Structured logs; never pass images, secrets or free text from users. */
export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface Settings {
  /** Subscriber credits per month (Q-05). */
  readonly monthlyCredits: number;
  /** Generations per account per hour. */
  readonly generationsPerHour: number;
  /** New accounts per network address per day (stops free-credit farming). */
  readonly accountsPerAddressPerDay: number;
  /** Analytics batches per network address per hour (the endpoint needs no account). */
  readonly eventBatchesPerAddressPerHour: number;
  /** Provider time limit (03 §2: time out at 60 s and refund). */
  readonly generationTimeoutMs: number;
  /** The same for videos (AI-14), which take minutes. */
  readonly videoTimeoutMs: number;
}

export interface Dependencies {
  readonly store: Store;
  readonly images: ImageStore;
  readonly generator: ImageGenerator;
  readonly upscaler: ImageUpscaler;
  readonly videoGenerator: VideoGenerator;
  readonly moderator: Moderator;
  readonly logger: Logger;
  readonly settings: Settings;
  readonly now: () => number;
}

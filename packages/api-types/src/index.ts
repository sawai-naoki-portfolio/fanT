import { z } from 'zod';

/**
 * The HTTP API between the app and Cloud Functions (07 §2). Both sides validate
 * with these schemas: the server every request, the app every response.
 */

/** Error codes the app can act on; anything else is shown as a generic failure. */
export const API_ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'insufficient_credits',
  'rate_limited',
  'moderation_blocked',
  'timeout',
  'unavailable',
  'internal',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  error: z.object({ code: z.enum(API_ERROR_CODES), message: z.string() }),
});

/** A device's credential: 32 random bytes in base64url, generated and kept on the device. */
export const accountSecretSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'A 256-bit base64url secret');

export const createAccountRequestSchema = z.strictObject({ secret: accountSecretSchema });

export const accountIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/);

export const creditsSchema = z.object({
  /** Credits usable now: this month's subscriber grant first, then purchased and free ones. */
  total: z.number().int().min(0),
  /** Left of this month's subscriber grant; does not carry over (04 §2). */
  monthly: z.number().int().min(0),
  /** Purchased and free credits; these never expire. */
  purchased: z.number().int().min(0),
});
export type Credits = z.infer<typeof creditsSchema>;

export const createAccountResponseSchema = z.object({
  accountId: accountIdSchema,
  credits: creditsSchema,
});
export type CreateAccountResponse = z.infer<typeof createAccountResponseSchema>;

export const creditsResponseSchema = z.object({ credits: creditsSchema });

/** Largest accepted upload: a 1024px JPEG is far smaller. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
/** Uploads are scaled to this long edge first, so nothing larger leaves the device. */
export const UPLOAD_LONG_EDGE = 1024;

/** Largest accepted mask: a small PNG of the area to change. */
export const MAX_MASK_BYTES = 512 * 1024;

/**
 * AI tools beside the styles (AI-10, AI-11, AI-13, AI-14), with their prices in
 * credits. `erase` takes a mask of what to remove and `expand` a mask of the new
 * margin to fill in; `upscale` doubles the resolution; `animate` makes a short
 * video, which costs the provider far more than an image.
 */
export const AI_TOOLS = {
  erase: { credits: 1 },
  expand: { credits: 1 },
  upscale: { credits: 1 },
  animate: { credits: 5 },
} as const;
export type AiTool = keyof typeof AI_TOOLS;

/** Tools whose result is an MP4 video rather than an image. */
export function isVideoTool(styleId: string): boolean {
  return styleId === 'animate';
}

const base64 = (maxBytes: number) =>
  z
    .string()
    .min(1)
    .max(Math.ceil((maxBytes * 4) / 3) + 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'base64');

export const createGenerationRequestSchema = z.strictObject({
  /** An AI style from the content, or an AI tool (`AI_TOOLS`). */
  styleId: z.string().regex(/^[a-z0-9][a-z0-9_]{0,47}$/),
  /** The photo as base64 JPEG. */
  image: base64(MAX_UPLOAD_BYTES),
  /** For `erase` and `expand`: base64 PNG, white where to change, the photo's size. */
  mask: base64(MAX_MASK_BYTES).optional(),
});

export const GENERATION_STATUSES = [
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const generationSchema = z.object({
  id: z.string().min(1),
  status: z.enum(GENERATION_STATUSES),
  /** A short-lived download link once succeeded: an image, or an MP4 for video tools. */
  imageUrl: z.url({ protocol: /^https$/ }).nullable(),
  /** Why it failed (credits are refunded for every failure). */
  error: z.enum(API_ERROR_CODES).nullable(),
  credits: creditsSchema,
});
export type Generation = z.infer<typeof generationSchema>;

/** Why a result is reported (AI-05). */
export const REPORT_REASONS = ['sexual', 'violent', 'hateful', 'not_me', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const reportRequestSchema = z.strictObject({ reason: z.enum(REPORT_REASONS) });

/** Analytics events (ANL-01), anonymous and capped in size. */
export const eventsRequestSchema = z.strictObject({
  installId: z.uuid(),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().max(32),
  events: z
    .array(
      z.strictObject({
        event: z.record(
          z.string().max(40),
          z.union([z.string().max(300), z.number(), z.boolean()]),
        ),
        at: z.number().int(),
      }),
    )
    .max(50),
});
export type EventsRequest = z.infer<typeof eventsRequestSchema>;

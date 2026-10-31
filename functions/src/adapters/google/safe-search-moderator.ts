import { z } from 'zod';

import type { Moderator } from '../../ports';
import { postJson, type Fetch, type TokenSource } from './http';

const LIKELIHOODS = [
  'UNKNOWN',
  'VERY_UNLIKELY',
  'UNLIKELY',
  'POSSIBLE',
  'LIKELY',
  'VERY_LIKELY',
] as const;
const likelihoodSchema = z.enum(LIKELIHOODS).catch('UNKNOWN');
const safeSearchResponseSchema = z.object({
  responses: z
    .array(
      z.object({
        safeSearchAnnotation: z
          .object({
            adult: likelihoodSchema,
            violence: likelihoodSchema,
            racy: likelihoodSchema,
          })
          .optional(),
        error: z.object({ message: z.string().optional() }).optional(),
      }),
    )
    .length(1),
});

/** Teen audience (01 §3): anything likely to be adult, racy or violent is refused. */
const BLOCK_FROM = LIKELIHOODS.indexOf('LIKELY');

/** Moderation with Cloud Vision SafeSearch (AI-05), for both uploads and results. */
export class SafeSearchModerator implements Moderator {
  constructor(private readonly options: { readonly token: TokenSource; readonly fetch?: Fetch }) {}

  async isAllowed(image: Uint8Array, signal: AbortSignal): Promise<boolean> {
    const json = await postJson(
      this.options.fetch ?? fetch,
      this.options.token,
      'https://vision.googleapis.com/v1/images:annotate',
      {
        requests: [
          {
            image: { content: Buffer.from(image).toString('base64') },
            features: [{ type: 'SAFE_SEARCH_DETECTION' }],
          },
        ],
      },
      signal,
    );
    const [result] = safeSearchResponseSchema.parse(json).responses;
    // An image Vision could not judge is not let through.
    if (result?.error !== undefined || result?.safeSearchAnnotation === undefined) {
      throw new Error(`SafeSearch failed: ${result?.error?.message ?? 'no annotation'}`);
    }
    const { adult, violence, racy } = result.safeSearchAnnotation;
    return [adult, violence, racy].every((value) => LIKELIHOODS.indexOf(value) < BLOCK_FROM);
  }
}

import { z } from 'zod';

import { ContentBlockedError, type VideoGenerator, type VideoShape } from '../../ports';
import { postJson, type Fetch, type TokenSource } from './http';

const LOCATION = 'us-central1';
/** Seconds of video: every Veo version accepts 6. */
const DURATION_SECONDS = 6;
const POLL_MS = 10_000;

const startResponseSchema = z.object({ name: z.string().min(1) });

const operationSchema = z.object({
  done: z.boolean().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
  response: z
    .object({
      raiMediaFilteredCount: z.number().optional(),
      raiMediaFilteredReasons: z.array(z.string()).optional(),
      videos: z
        .array(
          z.object({ bytesBase64Encoded: z.string().optional(), mimeType: z.string().optional() }),
        )
        .optional(),
    })
    .optional(),
});

/** Waits, or rejects as soon as `signal` aborts (the job timed out). */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason as Error);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason as Error);
      },
      { once: true },
    );
  });
}

/**
 * Image-to-video with Veo on Vertex AI (AI-14): starts a long-running prediction
 * and polls it until the video is ready. The video comes back inline (no bucket),
 * and Veo's own safety filters stand in for moderating the result.
 */
export class VeoVideoGenerator implements VideoGenerator {
  constructor(
    private readonly options: {
      readonly project: string;
      readonly model: string;
      readonly token: TokenSource;
      readonly fetch?: Fetch;
      /** Injectable for tests. */
      readonly wait?: (ms: number, signal: AbortSignal) => Promise<void>;
    },
  ) {}

  async animate(
    image: Uint8Array,
    prompt: string,
    shape: VideoShape,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    const { project, model, token } = this.options;
    const fetchFn = this.options.fetch ?? fetch;
    const pause = this.options.wait ?? wait;
    const base = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${LOCATION}/publishers/google/models/${encodeURIComponent(model)}`;
    const { name } = startResponseSchema.parse(
      await postJson(
        fetchFn,
        token,
        `${base}:predictLongRunning`,
        {
          instances: [
            {
              prompt,
              image: {
                bytesBase64Encoded: Buffer.from(image).toString('base64'),
                mimeType: 'image/jpeg',
              },
            },
          ],
          parameters: {
            sampleCount: 1,
            durationSeconds: DURATION_SECONDS,
            aspectRatio: shape === 'portrait' ? '9:16' : '16:9',
            generateAudio: false,
          },
        },
        signal,
      ),
    );
    for (;;) {
      await pause(POLL_MS, signal);
      const operation = operationSchema.parse(
        await postJson(
          fetchFn,
          token,
          `${base}:fetchPredictOperation`,
          { operationName: name },
          signal,
        ),
      );
      if (operation.done !== true) continue;
      if (operation.error !== undefined) {
        throw new Error(`Veo failed: ${operation.error.message ?? 'unknown error'}`);
      }
      const data = operation.response?.videos?.find(
        (video) => video.bytesBase64Encoded !== undefined,
      )?.bytesBase64Encoded;
      if (data !== undefined) return new Uint8Array(Buffer.from(data, 'base64'));
      if ((operation.response?.raiMediaFilteredCount ?? 0) > 0) {
        throw new ContentBlockedError(
          `Video blocked: ${(operation.response?.raiMediaFilteredReasons ?? []).join(', ')}`,
        );
      }
      throw new Error('No video in the Veo response');
    }
  }
}

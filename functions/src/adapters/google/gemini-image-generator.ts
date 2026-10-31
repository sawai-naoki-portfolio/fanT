import { z } from 'zod';

import { ContentBlockedError, type ImageGenerator } from '../../ports';
import { postJson, type Fetch, type TokenSource } from './http';

const geminiResponseSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z
              .array(
                z.object({
                  inlineData: z.object({ mimeType: z.string(), data: z.string() }).optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

/** Finish reasons that mean the model's safety filters stopped it. */
const BLOCKED_FINISH_REASONS = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
]);

/**
 * Image-to-image generation with a Gemini image model on Vertex AI (Q-04). Runs in
 * the project's own Google Cloud, so photos stay within it and are not used for
 * training (Vertex AI data governance).
 */
export class GeminiImageGenerator implements ImageGenerator {
  constructor(
    private readonly options: {
      readonly project: string;
      readonly model: string;
      readonly token: TokenSource;
      readonly fetch?: Fetch;
    },
  ) {}

  async generate(
    image: Uint8Array,
    prompt: string,
    signal: AbortSignal,
    mask?: Uint8Array,
  ): Promise<Uint8Array> {
    const { project, model, token } = this.options;
    const url = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/global/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
    const json = await postJson(
      this.options.fetch ?? fetch,
      token,
      url,
      {
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: { mimeType: 'image/jpeg', data: Buffer.from(image).toString('base64') },
              },
              ...(mask === undefined
                ? []
                : [
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: Buffer.from(mask).toString('base64'),
                      },
                    },
                  ]),
              { text: prompt },
            ],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'], candidateCount: 1 },
      },
      signal,
    );
    const parsed = geminiResponseSchema.parse(json);
    if (parsed.promptFeedback?.blockReason !== undefined)
      throw new ContentBlockedError(`Prompt blocked: ${parsed.promptFeedback.blockReason}`);
    const candidate = parsed.candidates?.[0];
    const data = candidate?.content?.parts?.find(
      (part) => part.inlineData?.mimeType.startsWith('image/') === true,
    )?.inlineData?.data;
    if (data !== undefined) return new Uint8Array(Buffer.from(data, 'base64'));
    if (BLOCKED_FINISH_REASONS.has(candidate?.finishReason ?? ''))
      throw new ContentBlockedError(`Result blocked: ${candidate?.finishReason ?? ''}`);
    throw new Error(`No image in the response (${candidate?.finishReason ?? 'no candidate'})`);
  }
}

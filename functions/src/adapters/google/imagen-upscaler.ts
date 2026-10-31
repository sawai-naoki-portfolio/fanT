import { z } from 'zod';

import type { ImageUpscaler } from '../../ports';
import { postJson, type Fetch, type TokenSource } from './http';

const upscaleResponseSchema = z.object({
  predictions: z.array(z.object({ bytesBase64Encoded: z.string().min(1) })).min(1),
});

/** Doubles a photo's resolution with Imagen's upscaler on Vertex AI (AI-11). */
export class ImagenUpscaler implements ImageUpscaler {
  constructor(
    private readonly options: {
      readonly project: string;
      readonly model: string;
      readonly token: TokenSource;
      readonly fetch?: Fetch;
    },
  ) {}

  async upscale(image: Uint8Array, signal: AbortSignal): Promise<Uint8Array> {
    const { project, model, token } = this.options;
    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/us-central1/publishers/google/models/${encodeURIComponent(model)}:predict`;
    const json = await postJson(
      this.options.fetch ?? fetch,
      token,
      url,
      {
        instances: [
          { prompt: '', image: { bytesBase64Encoded: Buffer.from(image).toString('base64') } },
        ],
        parameters: {
          sampleCount: 1,
          mode: 'upscale',
          upscaleConfig: { upscaleFactor: 'x2' },
          outputOptions: { mimeType: 'image/jpeg', compressionQuality: 92 },
        },
      },
      signal,
    );
    const [prediction] = upscaleResponseSchema.parse(json).predictions;
    if (prediction === undefined) throw new Error('No image in the upscale response');
    return new Uint8Array(Buffer.from(prediction.bytesBase64Encoded, 'base64'));
  }
}

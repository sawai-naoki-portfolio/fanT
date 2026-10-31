import { z } from 'zod';

import { availabilitySchema, contentIdSchema, localizedTextSchema } from './common';

/**
 * A style for AI generation (AI-02). Only the ID, the label and the price reach the
 * app; the prompt stays on the server, so it can be tuned (and kept safe) without
 * an app update.
 */
export const aiStyleSchema = z.strictObject({
  id: contentIdSchema,
  version: z.number().int().min(1),
  name: localizedTextSchema,
  description: localizedTextSchema,
  credits: z.number().int().min(1).max(10),
  availability: availabilitySchema.optional(),
});
export type AiStyle = z.infer<typeof aiStyleSchema>;

import { z } from 'zod';

/**
 * An unset value. app.config.ts writes `null`, but the iOS release build hands it
 * over as an empty object (an NSNull through the native bridge), so both count.
 */
function unset(value: unknown): unknown {
  const empty = typeof value === 'object' && value !== null && Object.keys(value).length === 0;
  return value === undefined || value === null || empty ? null : value;
}

/** A setting that may be left out; anything set must be valid. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(unset, schema.nullable());
}

const optionalString = optional(z.string().min(1));

const extraSchema = z.object({
  appVariant: z.enum(['development', 'preview', 'production']),
  contentBaseUrl: optional(z.url({ protocol: /^https$/ })),
  apiBaseUrl: optional(z.url({ protocol: /^https$/ })),
  revenueCatApiKey: z.object({ ios: optionalString, android: optionalString }),
  supportEmail: optional(z.email()),
  facebookAppId: optional(z.string().regex(/^\d{5,20}$/)),
});

/** Validates the build-time configuration from app.config.ts (`extra`). */
export function parseExtra(extra: unknown) {
  return extraSchema.parse(extra);
}

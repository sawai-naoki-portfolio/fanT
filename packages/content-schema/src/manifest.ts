import { z } from 'zod';

import { aiStyleSchema } from './ai-style';
import { characterSchema } from './character';
import { localizedTextSchema, type Availability } from './common';
import { filmSchema } from './film';
import { layoutSchema } from './layout';
import { phraseSchema, stampSchema } from './stamp';

const collection = <T extends z.ZodType<{ id: string }>>(item: T) =>
  z
    .array(item)
    .max(500)
    .refine(
      (items) => new Set(items.map(({ id }) => id)).size === items.length,
      'IDs must be unique within a collection',
    );

/**
 * Remote configuration (ANL-03), delivered with the content: switches to turn a
 * feature off without an app update, and copy that can run as an A/B test.
 */
export const remoteConfigSchema = z.strictObject({
  /** Features that can be switched off, e.g. AI during a provider outage. On when absent. */
  features: z.strictObject({ ai: z.boolean().optional() }).optional(),
  /** The paywall's lead line; with several, each install sees one of them (A/B test). */
  paywallLead: z.array(localizedTextSchema).min(1).max(4).optional(),
});
export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

/** Everything the app can offer (CNT-01), as delivered from the content server. */
export const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  films: collection(filmSchema),
  characters: collection(characterSchema),
  layouts: collection(layoutSchema),
  stamps: collection(stampSchema),
  phrases: collection(phraseSchema),
  aiStyles: collection(aiStyleSchema),
  config: remoteConfigSchema.optional(),
});
export type Manifest = z.infer<typeof manifestSchema>;

type Collections = Omit<Manifest, 'schemaVersion'>;
const COLLECTIONS = [
  'films',
  'characters',
  'layouts',
  'stamps',
  'phrases',
  'aiStyles',
] as const satisfies readonly (keyof Collections)[];

/** Validates untrusted JSON (e.g. a download) and throws `ZodError` when it does not match. */
export function parseManifest(json: unknown): Manifest {
  return manifestSchema.parse(json);
}

interface Versioned {
  readonly id: string;
  readonly version?: number;
}

function mergeById<T extends Versioned>(builtIn: readonly T[], remote: readonly T[]): T[] {
  const merged = new Map<string, T>(builtIn.map((item) => [item.id, item]));
  for (const item of remote) {
    const current = merged.get(item.id);
    if (current === undefined || (item.version ?? 0) > (current.version ?? 0)) {
      merged.set(item.id, item);
    }
  }
  return [...merged.values()];
}

/**
 * Built-in content (always available offline, CNT-05) plus downloaded content. A
 * downloaded item replaces a built-in one only when its version is newer; a
 * downloaded config replaces the built-in one.
 */
export function mergeManifests(builtIn: Manifest, remote: Manifest | null): Manifest {
  if (remote === null) return builtIn;
  const merged = { schemaVersion: 1, config: remote.config ?? builtIn.config } as Manifest;
  for (const key of COLLECTIONS) {
    (merged as Record<string, unknown>)[key] = mergeById<Versioned>(builtIn[key], remote[key]);
  }
  return merged;
}

/** Days an item counts as new after it is published (CNT-03). */
export const NEW_BADGE_DAYS = 14;

/** Whether an item is inside its delivery window (CNT-04); built-in items always are. */
export function isAvailable(item: { readonly availability?: Availability }, now: Date): boolean {
  const { availability } = item;
  if (availability === undefined) return true;
  const time = now.getTime();
  const until = availability.availableUntil;
  return (
    Date.parse(availability.publishedAt) <= time &&
    (until === undefined || time < Date.parse(until))
  );
}

export function isNew(item: { readonly availability?: Availability }, now: Date): boolean {
  const publishedAt = item.availability?.publishedAt;
  if (publishedAt === undefined) return false;
  const age = now.getTime() - Date.parse(publishedAt);
  return age >= 0 && age < NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;
}

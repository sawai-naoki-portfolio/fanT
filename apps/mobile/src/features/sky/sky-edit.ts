import { z } from 'zod';

import { areaToneSchema, changesTone } from '../selection/area-tone';

/**
 * Changes to the sky alone (EDT-25), found on the device: its brightness, colour
 * and warmth, or a new sky (a scenery backdrop) in its place.
 */
export const skyEditSchema = areaToneSchema.extend({
  /** A backdrop ID from `BACKDROPS` to put in place of the sky, or `null`. */
  backdrop: z.string().max(32).nullable().default(null),
});
export type SkyEdit = z.infer<typeof skyEditSchema>;

export const NO_SKY_EDIT: SkyEdit = skyEditSchema.parse({});

export function editsSky(edit: SkyEdit): boolean {
  return changesTone(edit) || edit.backdrop !== null;
}

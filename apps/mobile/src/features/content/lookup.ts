import {
  isAvailable,
  type Character,
  type CharacterVariant,
  type Film,
  type Manifest,
  type Stamp,
} from '@fant/content-schema';

/**
 * The film with this ID, or the first film when it no longer exists (e.g. a seasonal
 * film that ended), so an old photo or setting never breaks rendering.
 */
export function findFilm(manifest: Manifest, id: string): Film {
  const film = manifest.films.find((candidate) => candidate.id === id) ?? manifest.films[0];
  if (film === undefined) throw new Error('No films available');
  return film;
}

export interface ResolvedCharacter {
  readonly character: Character;
  readonly variant: CharacterVariant;
}

export function findCharacter(
  manifest: Manifest,
  id: string,
  variantId: string | undefined,
): ResolvedCharacter | null {
  const character = manifest.characters.find((candidate) => candidate.id === id);
  if (character === undefined) return null;
  const variant =
    character.variants.find(({ id: candidate }) => candidate === variantId) ??
    character.variants[0];
  return variant === undefined ? null : { character, variant };
}

export function stampMap(manifest: Manifest): ReadonlyMap<string, Stamp> {
  return new Map(manifest.stamps.map((stamp) => [stamp.id, stamp]));
}

/** Items to offer now (CNT-04), in manifest order. */
export function available<T extends { readonly availability?: Film['availability'] }>(
  items: readonly T[],
  now = new Date(),
): T[] {
  return items.filter((item) => isAvailable(item, now));
}

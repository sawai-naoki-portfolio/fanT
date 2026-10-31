import { LOOK_KEYS, type Look, type PhotoRecipe } from '../photo/recipe';

/** The look of a recipe (EDT-33): what is copied and kept in presets. */
export function lookOf(recipe: PhotoRecipe): Look {
  return Object.fromEntries(LOOK_KEYS.map((key) => [key, recipe[key]])) as Look;
}

/** `recipe` with `look` in place of its own; framing, decorations and retouching stay. */
export function withLook(recipe: PhotoRecipe, look: Look): PhotoRecipe {
  return { ...recipe, ...look };
}

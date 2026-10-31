import { FULL_CROP, neutralRecipe, type PhotoRecipe } from '../photo/recipe';

/** What the editor's preview shows besides the edited photo. */
export interface PreviewView {
  /** The photo before its look and retouching (EDT-28), framed as edited. */
  readonly before: boolean;
  /** The whole photo, for cropping it freely (EDT-29). */
  readonly uncropped: boolean;
  /** Without decorations, which the deco editor draws itself. */
  readonly withoutDeco: boolean;
}

export const EDITED_VIEW: PreviewView = { before: false, uncropped: false, withoutDeco: false };

/** The recipe the preview renders for `view`. */
export function previewRecipeOf(recipe: PhotoRecipe, view: PreviewView): PhotoRecipe {
  const base = view.before
    ? { ...neutralRecipe(recipe.seed), transform: recipe.transform }
    : recipe;
  return {
    ...base,
    deco: view.withoutDeco || view.before ? [] : base.deco,
    transform: view.uncropped ? { ...base.transform, crop: FULL_CROP } : base.transform,
  };
}

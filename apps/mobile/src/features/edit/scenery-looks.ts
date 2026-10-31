import type { AdjustParams, DetailParams, LensParams } from '@fant/filters';

import type { PhotoRecipe } from '../photo/recipe';

/** One-tap scenery looks (EDT-22): settings of existing sliders, refined with them after. */
export const SCENERY_LOOKS = {
  /** Every tone visible: shadows lifted, highlights held, local contrast up. */
  hdr: {
    detail: { shadows: 0.6, highlights: -0.6, clarity: 0.5, vibrance: 0.25 },
  },
  /** Heavy, moody contrast with muted colour and darker corners. */
  drama: {
    adjust: { contrast: 0.25, saturation: -0.25 },
    detail: { clarity: 0.8, shadows: 0.2, highlights: -0.3 },
    lens: { vignette: -0.4 },
  },
  /** Clear air, blue sky and rich colour. */
  vivid: {
    detail: { dehaze: 0.25, sky: 0.4, vibrance: 0.5 },
  },
  /** Soft and dreamy: a light mist and gentle detail. */
  soft: {
    detail: { dehaze: -0.25, clarity: -0.4, highlights: 0.2 },
  },
} as const satisfies Record<
  string,
  {
    readonly adjust?: Partial<AdjustParams>;
    readonly detail?: Partial<DetailParams>;
    readonly lens?: Partial<LensParams>;
  }
>;
export type SceneryLook = keyof typeof SCENERY_LOOKS;

/** The recipe change of a look: its values set, every other value kept. */
export function withSceneryLook(
  recipe: PhotoRecipe,
  look: SceneryLook,
): Pick<PhotoRecipe, 'adjust' | 'detail' | 'lens'> {
  const values: {
    readonly adjust?: Partial<AdjustParams>;
    readonly detail?: Partial<DetailParams>;
    readonly lens?: Partial<LensParams>;
  } = SCENERY_LOOKS[look];
  return {
    adjust: { ...recipe.adjust, ...values.adjust },
    detail: { ...recipe.detail, ...values.detail },
    lens: { ...recipe.lens, ...values.lens },
  };
}

import type { HairHead } from '@fant/filters';
import type { SkCanvas, SkImage, SkMatrix } from '@shopify/react-native-skia';

import type { Backdrop } from '../../features/photo/backdrops';
import type { Size } from '../../features/photo/geometry';
import type { FocusBlur } from '../../features/retouch/focus-blur';
import type { Hair, HealSpot } from '../../features/retouch/retouch';
import type { DecoStroke } from '../../features/photo/recipe';
import type { AreaTone } from '../../features/selection/area-tone';
import type { SkyEdit } from '../../features/sky/sky-edit';

/** A mask image (alpha = keep) with the matrix that maps it onto the output. */
export interface PlacedMask {
  readonly image: SkImage;
  readonly matrix: SkMatrix;
}

/** Everything done to the photo before the filter chain, in output pixels. */
export interface RetouchInput {
  readonly heal: readonly HealSpot[];
  readonly backdrop: Backdrop | null;
  readonly backgroundBlur: number;
  readonly hair: Hair;
  /** The people (alpha = person). */
  readonly mask: PlacedMask | null;
  /** The sky (EDT-25): where it is, what changes, and the backdrop for a new sky. */
  readonly sky: {
    readonly mask: PlacedMask | null;
    readonly edit: SkyEdit;
    readonly backdrop: Backdrop | null;
  };
  /** Heads in output pixels, for hair colour. */
  readonly heads: readonly HairHead[];
  /** Tilt-shift (EDT-23): blur beyond the focus; needs no mask. */
  readonly focusBlur: FocusBlur;
  /** The people and the background toned on their own (EDT-34), with `mask`. */
  readonly selective: { readonly people: AreaTone; readonly background: AreaTone };
  /** A painted area toned on its own (EDT-35). */
  readonly brush: { readonly strokes: readonly DecoStroke[]; readonly tone: AreaTone };
}

/** What a step draws with: the canvas holding the photo so far, and a way to copy it. */
export interface RetouchContext {
  readonly canvas: SkCanvas;
  readonly size: Size;
  /** The photo as drawn so far; freed when the retouch ends. */
  readonly current: () => SkImage;
}

/** One retouching step: whether it has anything to do, and doing it on the canvas. */
export interface RetouchStep {
  readonly applies: (input: RetouchInput) => boolean;
  readonly run: (context: RetouchContext, input: RetouchInput) => void;
}

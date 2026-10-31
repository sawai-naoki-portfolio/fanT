import {
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkShader,
} from '@shopify/react-native-skia';

import type { Size } from '../features/photo/geometry';
import { backdropStep } from './retouch/steps/backdrop';
import { backgroundBlurStep } from './retouch/steps/background-blur';
import { brushStep } from './retouch/steps/brush';
import { focusStep } from './retouch/steps/focus';
import { hairStep } from './retouch/steps/hair';
import { healStep } from './retouch/steps/heal';
import { selectiveStep } from './retouch/steps/selective';
import { skyStep } from './retouch/steps/sky';
import type { RetouchInput, RetouchStep } from './retouch/types';
import { makeSurface } from './surface';

export type { PlacedMask, RetouchInput } from './retouch/types';

/**
 * The steps, in order: the sky (EDT-25), the people and the background (EDT-34),
 * a painted area (EDT-35), a new backdrop (EDT-16) and background blur behind the
 * people (EDT-11), hair colour (EDT-12), blemish removal (BTY-11) and tilt-shift
 * (EDT-23). A new step is added here, not inside another.
 */
const STEPS: readonly RetouchStep[] = [
  skyStep,
  selectiveStep,
  brushStep,
  backdropStep,
  backgroundBlurStep,
  hairStep,
  healStep,
  focusStep,
];

/** Whether there is anything to do before the filter chain. */
export function hasRetouch(input: RetouchInput): boolean {
  return STEPS.some((step) => step.applies(input));
}

/**
 * Prepares the photo before the filter chain, in output pixels, running every step
 * that applies. Returns a shader for the chain to draw from; the caller calls `dispose`.
 */
export function retouchSource(
  source: SkShader,
  size: Size,
  input: RetouchInput,
): { readonly shader: SkShader; readonly dispose: () => void } {
  const surface = makeSurface(size.width, size.height);
  const canvas = surface.getCanvas();
  const images: SkImage[] = [];
  const current = () => {
    surface.flush();
    const image = surface.makeImageSnapshot();
    images.push(image);
    return image;
  };
  const paint = Skia.Paint();
  try {
    paint.setShader(source);
    canvas.drawRect(Skia.XYWHRect(0, 0, size.width, size.height), paint);
    for (const step of STEPS) {
      if (step.applies(input)) step.run({ canvas, size, current }, input);
    }
    surface.flush();
    const result = surface.makeImageSnapshot();
    const shader = result.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None,
    );
    return {
      shader,
      dispose: () => {
        shader.dispose();
        result.dispose();
      },
    };
  } finally {
    paint.dispose();
    for (const image of images) image.dispose();
    surface.dispose();
  }
}

import { FilterMode, MipmapMode, TileMode } from '@shopify/react-native-skia';

import { changesTone } from '../../../features/selection/area-tone';
import { softStrokeMask } from '../../stroke-mask';
import { keepWhere } from '../drawing';
import type { RetouchStep } from '../types';
import { toneLayer } from './selective';

/** Soft edge of a painted area, as a fraction of the photo's short edge. */
const FEATHER = 0.008;

/** The area painted with the adjustment brush, toned on its own (EDT-35). */
export const brushStep: RetouchStep = {
  applies: ({ brush }) => brush.strokes.length > 0 && changesTone(brush.tone),
  run: ({ canvas, size, current }, { brush }) => {
    const painted = softStrokeMask(brush.strokes, size, FEATHER);
    const shader = painted.makeShaderOptions(
      TileMode.Decal,
      TileMode.Decal,
      FilterMode.Linear,
      MipmapMode.None,
    );
    try {
      toneLayer(canvas, current(), brush.tone, () => {
        keepWhere(canvas, shader);
      });
    } finally {
      shader.dispose();
      painted.dispose();
    }
  },
};

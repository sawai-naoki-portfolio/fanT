import type { SkCanvas } from '@shopify/react-native-skia';

import type { FaceGeometry } from '../features/character/face-geometry.worklet';
import { hasMakeup, type Makeup } from '../features/makeup/makeup';
import { drawCharacter, type CharacterDrawing } from './draw-character';
import { drawMakeup } from './draw-makeup';

/**
 * What is drawn over the retouched faces and under the film look: makeup
 * (BTY-07/09/10), then the character (CHR-04). `null` when there is nothing to
 * draw. Shared by the live preview and the saved photo so both look the same;
 * `time` (seconds) is where moving parts are (CHR-08).
 */
export function faceOverlay(
  faces: readonly FaceGeometry[],
  makeup: Makeup | null,
  character: CharacterDrawing | null,
  time: number,
): ((canvas: SkCanvas) => void) | null {
  'worklet';
  const withMakeup = makeup !== null && hasMakeup(makeup);
  if (faces.length === 0 || (!withMakeup && character === null)) return null;
  return (canvas) => {
    'worklet';
    if (withMakeup) drawMakeup(canvas, makeup, faces);
    if (character !== null) drawCharacter(canvas, character, faces, time);
  };
}

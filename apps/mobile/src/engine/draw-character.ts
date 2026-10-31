import type { Character, CharacterVariant } from '@fant/content-schema';
import type { SkCanvas, SkImage } from '@shopify/react-native-skia';

import { placePart, type FaceGeometry } from '../features/character/face-geometry.worklet';
import { moveParts } from '../features/character/part-motion.worklet';
import { drawImageCentered } from './draw-image';
import { drawShape } from './draw-shape';
import { CHARACTER_SHAPE_ART } from './shapes';

export interface CharacterDrawing {
  readonly character: Character;
  readonly variant: CharacterVariant;
  /** Decoded image parts by asset hash; a part whose image is not loaded is skipped. */
  readonly images: Readonly<Record<string, SkImage>>;
}

/**
 * Draws a character's parts on every face (CHR-01/05), turned with the head (CHR-09)
 * and moving parts as they are at `time` seconds (CHR-08). Marked as a worklet so it
 * can run on the camera thread.
 */
export function drawCharacter(
  canvas: SkCanvas,
  drawing: CharacterDrawing,
  faces: readonly FaceGeometry[],
  time: number,
): void {
  'worklet';
  const { character, variant, images } = drawing;
  for (const face of faces) {
    for (const part of character.parts) {
      const placement = placePart(face, part);
      const placements =
        part.motion === undefined
          ? [placement]
          : moveParts(placement, part.motion, face.width, time);
      for (const at of placements) {
        if (part.art.type === 'shape') {
          drawShape(canvas, CHARACTER_SHAPE_ART[part.art.shape], variant.colors[part.art.fill], at);
        } else {
          const image = images[part.art.image.sha256];
          if (image !== undefined) drawImageCentered(canvas, image, at);
        }
      }
    }
  }
}

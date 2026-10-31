import type { Character, CharacterVariant } from '@fant/content-schema';
import { Canvas, Circle, Group, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { FaceGeometry } from '../features/character/face-geometry.worklet';
import { drawCharacter } from './draw-character';

/** When moving parts are shown in the still preview: mid-way, so they are spread out. */
const PREVIEW_TIME = 0.4;

/** A character on a plain face, for the character list (S-13). */
export function CharacterPreview({
  character,
  variant,
  size,
}: {
  readonly character: Character;
  readonly variant: CharacterVariant;
  readonly size: number;
}) {
  const picture = useMemo<SkPicture>(() => {
    const face: FaceGeometry = {
      center: { x: size / 2, y: size * 0.6 },
      width: size * 0.52,
      roll: 0,
      eyes: null,
      nose: null,
      cheeks: null,
      mouth: null,
      outline: null,
      yaw: 0,
      pitch: 0,
    };
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    drawCharacter(canvas, { character, variant, images: {} }, [face], PREVIEW_TIME);
    const recorded = recorder.finishRecordingAsPicture();
    recorder.dispose();
    return recorded;
  }, [character, variant, size]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        <Circle cx={size / 2} cy={size * 0.6} r={size * 0.27} color="#f3d2bd" />
        <Picture picture={picture} />
      </Group>
    </Canvas>
  );
}

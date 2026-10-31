import {
  compileRuntimeEffect,
  HAIR_SHADER_NAME,
  HAIR_SHADER_SOURCE,
  packUniforms,
  toHairUniforms,
} from '@fant/filters';
import {
  BlendMode,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';

import { rgbOf } from '../../../features/retouch/retouch';
import type { RetouchStep } from '../types';

let hairEffect: SkRuntimeEffect | undefined;

function hairShader(): SkRuntimeEffect {
  hairEffect ??= compileRuntimeEffect(Skia.RuntimeEffect, HAIR_SHADER_NAME, HAIR_SHADER_SOURCE);
  return hairEffect;
}

/** Hair colour (EDT-12): inside the people, around the heads, where it is not skin. */
export const hairStep: RetouchStep = {
  applies: ({ mask, hair, heads }) => mask !== null && hair.amount > 0 && heads.length > 0,
  run: ({ canvas, size, current }, { mask, hair, heads }) => {
    if (mask === null) return;
    const effect = hairShader();
    const imageShader = current().makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None,
    );
    const personShader = mask.image.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None,
      mask.matrix,
    );
    const uniforms = toHairUniforms(hair.amount, rgbOf(hair.color), heads, size);
    const shader = effect.makeShaderWithChildren(packUniforms(effect, uniforms), [
      imageShader,
      personShader,
    ]);
    const paint = Skia.Paint();
    try {
      paint.setShader(shader);
      paint.setBlendMode(BlendMode.Src);
      canvas.drawPaint(paint);
    } finally {
      paint.dispose();
      shader.dispose();
      personShader.dispose();
      imageShader.dispose();
    }
  },
};

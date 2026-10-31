import { assertFrameSize } from '../frame';
import { LUMA_SKSL, SKIN_SKSL } from '../sksl';

/** A head to recolour: its face centre and width, in frame pixels. */
export interface HairHead {
  readonly center: readonly [number, number];
  readonly width: number;
}

/** Heads the shader recolours at most. */
export const MAX_HAIR_HEADS = 4;

type Vec4 = readonly [number, number, number, number];
type HeadSlot = 0 | 1 | 2 | 3;

export type HairUniforms = {
  readonly resolution: readonly [number, number];
  readonly amount: number;
  readonly color: readonly [number, number, number];
} & { readonly [Slot in HeadSlot as `head${Slot}`]: Vec4 };

/** Marked as a worklet so it can run on the camera frame thread. */
export function toHairUniforms(
  amount: number,
  color: readonly [number, number, number],
  heads: readonly HairHead[],
  frame: { readonly width: number; readonly height: number },
): HairUniforms {
  'worklet';
  assertFrameSize(frame.width, frame.height);
  const head = (index: number): Vec4 => {
    const item = heads[index];
    return item === undefined ? [0, 0, 0, 0] : [item.center[0], item.center[1], item.width, 1];
  };
  return {
    resolution: [frame.width, frame.height],
    amount,
    color,
    head0: head(0),
    head1: head(1),
    head2: head(2),
    head3: head(3),
  };
}

export const HAIR_SHADER_NAME = 'hair_v1';

/**
 * `hair_v1`: hair colour (EDT-12). Children: `image` and `person` (the person mask,
 * alpha = person, in the same coordinates). Hair is estimated as person pixels
 * around and below each head that are not skin, then given the target hue while
 * keeping their own light and shade.
 */
export const HAIR_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform shader person;
uniform float2 resolution;
uniform float amount;
uniform float3 color;
uniform float4 head0;
uniform float4 head1;
uniform float4 head2;
uniform float4 head3;
${LUMA_SKSL}
${SKIN_SKSL}

// Where hair can be around one head: the crown and sides, and lengths down to the shoulders.
float hairArea(float2 p, float4 head) {
  if (head.w < 0.5) return 0.0;
  float w = head.z;
  float2 d = (p - (head.xy - float2(0.0, w * 0.15))) / float2(w * 0.95, w * 1.0);
  float crown = 1.0 - smoothstep(0.85, 1.0, length(d));
  float side = abs(p.x - head.x) / w;
  float below = (p.y - head.y) / w;
  float lengths = smoothstep(0.3, 0.45, side) * (1.0 - smoothstep(0.95, 1.1, side))
    * step(0.0, below) * (1.0 - smoothstep(1.4, 1.7, below));
  return max(crown, lengths);
}

half4 main(float2 coord) {
  half4 source = unpremul(image.eval(coord));
  float area = max(max(hairArea(coord, head0), hairArea(coord, head1)),
                   max(hairArea(coord, head2), hairArea(coord, head3)));
  if (area <= 0.0 || amount <= 0.0) return image.eval(coord);
  float weight = area * float(person.eval(coord).a) * (1.0 - skinMask(float3(source.rgb)));
  if (weight <= 0.001) return image.eval(coord);
  half luma = dot(source.rgb, LUMA);
  // Dark hair shows little colour: lift it a little so the new colour reads.
  half lifted = mix(luma, max(luma, 0.32), 0.6);
  half targetLuma = max(dot(half3(color), LUMA), 0.05);
  half3 recoloured = saturate(half3(color) * (lifted / targetLuma));
  half3 result = mix(source.rgb, recoloured, half(weight * amount));
  return half4(result * source.a, source.a);
}
`;

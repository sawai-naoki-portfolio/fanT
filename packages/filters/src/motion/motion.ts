export const MOTION_SHADER_NAME = 'motion_v1';

/** Uniforms of the motion shader. */
export interface MotionUniforms {
  readonly resolution: readonly [number, number];
  /** How far the painted area flows in one loop, in short-edge units, as (x, y). */
  readonly flow: readonly [number, number];
  /** Where in the loop this frame is, from 0 up to (not including) 1. */
  readonly phase: number;
}

/**
 * `motion_v1`: one frame of a moving photo (EDT-37). Inside the mask the photo
 * flows along `flow`: two copies, one a full loop behind the other, cross-fade as
 * the phase advances, so the last frame leads seamlessly into the first. Outside
 * the mask the photo stays still.
 */
export const MOTION_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform shader mask;
uniform float2 resolution;
uniform float2 flow;
uniform float phase;

half4 main(float2 coord) {
  half4 still = image.eval(coord);
  half moving = mask.eval(coord).a;
  if (moving <= 0.0) return still;
  float2 step = flow * min(resolution.x, resolution.y);
  half4 ahead = image.eval(coord - step * phase);
  half4 behind = image.eval(coord - step * (phase - 1.0));
  half4 flowing = mix(ahead, behind, half(phase));
  return mix(still, flowing, moving);
}
`;

/** Ways a painted area can flow (EDT-37), as unit directions on screen (y down). */
export const MOTION_DIRECTIONS = {
  right: [1, 0],
  left: [-1, 0],
  down: [0, 1],
  up: [0, -1],
  downRight: [Math.SQRT1_2, Math.SQRT1_2],
  upRight: [Math.SQRT1_2, -Math.SQRT1_2],
} as const satisfies Record<string, readonly [number, number]>;
export type MotionDirection = keyof typeof MOTION_DIRECTIONS;

/** Frames a second, and the loop's length: short loops play smoothly and stay small. */
export const MOTION_FPS = 24;
export const MOTION_LOOP_SECONDS = 2;
export const MOTION_FRAME_COUNT = MOTION_FPS * MOTION_LOOP_SECONDS;

/** The farthest the area flows in one loop, in short-edge units. */
const MAX_FLOW = 0.12;

/** How far and which way the painted area flows in one loop, at `speed` (0–1). */
export function flowOf(direction: MotionDirection, speed: number): readonly [number, number] {
  const [x, y] = MOTION_DIRECTIONS[direction];
  const distance = Math.min(1, Math.max(0, speed)) * MAX_FLOW;
  return [x * distance, y * distance];
}

/** The phase (0 up to 1) of each of `count` frames of one loop. */
export function loopPhases(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index / count);
}

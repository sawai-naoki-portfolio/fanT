import type { Crop } from './recipe';

/** The corners of a crop that can be dragged (EDT-29). */
export const CROP_CORNERS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
export type CropCorner = (typeof CROP_CORNERS)[number];

/** The smallest crop, as a fraction of each side, so it never collapses. */
const MIN_SIDE = 0.1;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** `crop` with one corner dragged by `dx`, `dy` (fractions of the photo); the others stay. */
export function dragCorner(crop: Crop, corner: CropCorner, dx: number, dy: number): Crop {
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.width;
  let bottom = crop.y + crop.height;
  if (corner === 'topLeft' || corner === 'bottomLeft') left = clamp(left + dx, 0, right - MIN_SIDE);
  else right = clamp(right + dx, left + MIN_SIDE, 1);
  if (corner === 'topLeft' || corner === 'topRight') top = clamp(top + dy, 0, bottom - MIN_SIDE);
  else bottom = clamp(bottom + dy, top + MIN_SIDE, 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** `crop` moved by `dx`, `dy`, kept inside the photo. */
export function moveCrop(crop: Crop, dx: number, dy: number): Crop {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, 1 - crop.width),
    y: clamp(crop.y + dy, 0, 1 - crop.height),
  };
}

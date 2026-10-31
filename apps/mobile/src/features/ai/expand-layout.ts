import type { Size } from '../photo/geometry';

/** Shapes a photo can be widened to (AI-13); `wider` keeps its shape with a margin all round. */
export const EXPAND_SHAPES = ['9:16', '4:5', '1:1', '16:9', 'wider'] as const;
export type ExpandShape = (typeof EXPAND_SHAPES)[number];

const ASPECTS: Record<Exclude<ExpandShape, 'wider'>, number> = {
  '9:16': 9 / 16,
  '4:5': 4 / 5,
  '1:1': 1,
  '16:9': 16 / 9,
};

/** How much bigger the canvas gets when the photo already has the chosen shape. */
const MARGIN_SCALE = 1.3;

export interface ExpandLayout {
  /** The widened canvas, at most `maxLongEdge` on its long edge, in whole pixels. */
  readonly canvas: Size;
  /** Where the photo sits on it, centred. */
  readonly photo: { readonly x: number; readonly y: number } & Size;
}

/** Fits the photo into the smallest canvas of `shape` around it, scaled to the upload size. */
export function expandLayout(photo: Size, shape: ExpandShape, maxLongEdge: number): ExpandLayout {
  let width = photo.width;
  let height = photo.height;
  const aspect = shape === 'wider' ? null : ASPECTS[shape];
  if (aspect !== null) {
    if (photo.width / photo.height < aspect) width = photo.height * aspect;
    else height = photo.width / aspect;
  }
  // Nothing to fill: widen in place instead.
  if (width / photo.width < 1.02 && height / photo.height < 1.02) {
    width *= MARGIN_SCALE;
    height *= MARGIN_SCALE;
  }
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  const canvas = {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
  const placed = {
    width: Math.round(photo.width * scale),
    height: Math.round(photo.height * scale),
  };
  return {
    canvas,
    photo: {
      ...placed,
      x: Math.round((canvas.width - placed.width) / 2),
      y: Math.round((canvas.height - placed.height) / 2),
    },
  };
}

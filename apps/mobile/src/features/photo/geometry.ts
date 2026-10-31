import type { AspectRatio, Crop, QuarterTurn } from './recipe';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Width ÷ height of each portrait aspect ratio (CAM-05). */
export const ASPECT_VALUES: Record<AspectRatio, number> = {
  '3:4': 3 / 4,
  '9:16': 9 / 16,
  '1:1': 1,
};

/** The largest centred crop of `size` with the given width ÷ height. */
export function centerCrop(size: Size, aspect: number): Crop {
  const current = size.width / size.height;
  if (current > aspect) {
    const width = aspect / current;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = current / aspect;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

/** The image size after quarter turns. */
export function rotatedSize(size: Size, rotation: QuarterTurn): Size {
  return rotation === 90 || rotation === 270 ? { width: size.height, height: size.width } : size;
}

/** The output size of a recipe's transform, rounded to whole pixels. */
export function croppedSize(size: Size, rotation: QuarterTurn, crop: Crop): Size {
  const turned = rotatedSize(size, rotation);
  return {
    width: Math.max(1, Math.round(turned.width * crop.width)),
    height: Math.max(1, Math.round(turned.height * crop.height)),
  };
}

/** Scales a size down so its long edge is at most `maxLongEdge` (SHR-04). */
export function fitLongEdge(size: Size, maxLongEdge: number): Size {
  const longEdge = Math.max(size.width, size.height);
  if (longEdge <= maxLongEdge) return size;
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * Fits `content` inside `container` keeping its aspect ratio, centred
 * ("contain"); returns the drawn rectangle.
 */
export function containRect(content: Size, container: Size) {
  const scale = Math.min(container.width / content.width, container.height / content.height);
  const width = content.width * scale;
  const height = content.height * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height };
}

/** Next quarter turn clockwise. */
export function turnClockwise(rotation: QuarterTurn): QuarterTurn {
  return ((rotation + 90) % 360) as QuarterTurn;
}

import { compose, rotateAround, scale, translate, type Affine } from '../../engine/affine.worklet';
import { rotatedSize, type Size } from './geometry';
import { composeProjective, fromAffine, homography, type Projective } from './projective';
import type { PhotoRecipe } from './recipe';

/** How far a corner moves in at full perspective correction, as a fraction of the side. */
const MAX_KEYSTONE = 0.3;

/**
 * How much a `size` image turned by `degrees` must grow to cover its own frame, so
 * straightening never shows empty corners.
 */
export function straightenZoom(size: Size, degrees: number): number {
  const radians = (Math.abs(degrees) * Math.PI) / 180;
  const longOverShort = Math.max(size.width, size.height) / Math.min(size.width, size.height);
  return Math.cos(radians) + Math.sin(radians) * longOverShort;
}

/** Turns an image of `size` around its centre and zooms in to fill its frame. */
function straightenAffine(size: Size, degrees: number): Affine {
  if (degrees === 0) return [1, 0, 0, 0, 1, 0];
  const center = { x: size.width / 2, y: size.height / 2 };
  const zoom = straightenZoom(size, degrees);
  return compose(
    rotateAround(degrees, center),
    compose(
      translate(center.x, center.y),
      compose(scale(zoom, zoom), translate(-center.x, -center.y)),
    ),
  );
}

/**
 * Keystone correction (EDT-18): a quad inside the frame is spread to fill it, so
 * lines that converge in the photo become parallel and no corner is left empty.
 * Positive `vertical` widens the top (buildings shot from below), positive
 * `horizontal` the right side; negative values the opposite sides.
 */
function perspectiveProjective(
  size: Size,
  { vertical, horizontal }: PhotoRecipe['transform']['perspective'],
): Projective {
  if (vertical === 0 && horizontal === 0) return fromAffine([1, 0, 0, 0, 1, 0]);
  const { width: w, height: h } = size;
  const inX = (side: 'top' | 'bottom') =>
    (side === 'top' ? Math.max(0, vertical) : Math.max(0, -vertical)) * MAX_KEYSTONE * w;
  const inY = (side: 'left' | 'right') =>
    (side === 'right' ? Math.max(0, horizontal) : Math.max(0, -horizontal)) * MAX_KEYSTONE * h;
  return homography(
    [
      { x: inX('top'), y: inY('left') },
      { x: w - inX('top'), y: inY('right') },
      { x: w - inX('bottom'), y: h - inY('right') },
      { x: inX('bottom'), y: h - inY('left') },
    ],
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
  );
}

/**
 * Maps pixels of the original (upright) photo to pixels of the output: mirror,
 * then quarter turns clockwise, straightening, perspective, then the crop. The
 * renderer draws with it and face positions found on the original follow it.
 */
export function recipeTransform(original: Size, transform: PhotoRecipe['transform']): Projective {
  const { width, height } = original;
  const mirror: Affine = transform.mirror ? [-1, 0, width, 0, 1, 0] : [1, 0, 0, 0, 1, 0];
  const rotations: Record<PhotoRecipe['transform']['rotation'], Affine> = {
    0: [1, 0, 0, 0, 1, 0],
    90: [0, -1, height, 1, 0, 0],
    180: [-1, 0, width, 0, -1, height],
    270: [0, 1, 0, -1, 0, width],
  };
  const turned = rotatedSize(original, transform.rotation);
  const crop = translate(-transform.crop.x * turned.width, -transform.crop.y * turned.height);
  const upright = compose(
    straightenAffine(turned, transform.straighten),
    compose(rotations[transform.rotation], mirror),
  );
  return composeProjective(
    fromAffine(crop),
    composeProjective(perspectiveProjective(turned, transform.perspective), fromAffine(upright)),
  );
}

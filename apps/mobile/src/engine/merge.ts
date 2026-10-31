import {
  compileRuntimeEffect,
  EXPOSURE_FUSION_SHADER_NAME,
  EXPOSURE_FUSION_SHADER_SOURCE,
  packUniforms,
  type ExposureFusionUniforms,
} from '@fant/filters';
import {
  BlendMode,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  vec,
  type SkImage,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';

import { alignShift, commonArea, type Shift } from '../features/merge/align';
import { toGray } from '../features/merge/gray';
import { panoramaLayout, panoramaOffset } from '../features/merge/panorama';
import { imageSize } from './photo';
import { samplePixels } from './sample-pixels';
import { coverTo, decodeScaled } from './scaled-image';
import { makeSurface } from './surface';

/** Long edge of the copies alignment is measured on. */
const ALIGN_EDGE = 320;
/** Long edge of the copies a panorama's overlaps are measured on. */
const PANORAMA_SAMPLE_EDGE = 240;
/** Widest panorama: past this, GPUs refuse the texture. */
const MAX_PANORAMA_EDGE = 8000;

let fusion: SkRuntimeEffect | undefined;

function firstOf(images: readonly SkImage[]): SkImage {
  const first = images[0];
  if (first === undefined) throw new RangeError('No photos');
  return first;
}

/** Decodes photos one at a time at `maxEdge`, all at the first one's size. */
async function decodeAll(uris: readonly string[], maxEdge: number): Promise<SkImage[]> {
  const images: SkImage[] = [];
  try {
    for (const uri of uris) {
      const decoded = await decodeScaled(uri, maxEdge);
      const first = images[0];
      if (
        first === undefined ||
        (decoded.width() === first.width() && decoded.height() === first.height())
      ) {
        images.push(decoded);
      } else {
        images.push(coverTo(decoded, imageSize(first)));
        decoded.dispose();
      }
    }
    return images;
  } catch (error) {
    for (const image of images) image.dispose();
    throw error;
  }
}

/**
 * Merges two or three exposures of one scene into one (EDT-26): aligned to the
 * middle one, cropped to what all of them show, then fused where each is well
 * exposed. Hand-held shots are fine as long as the scene itself stays still.
 */
export async function mergeExposures(uris: readonly string[], maxEdge: number): Promise<SkImage> {
  if (uris.length < 2 || uris.length > 3) throw new RangeError('Merge two or three exposures');
  const images = await decodeAll(uris, maxEdge);
  const shaders: ReturnType<SkImage['makeShaderOptions']>[] = [];
  const matrices: ReturnType<typeof Skia.Matrix>[] = [];
  try {
    const size = imageSize(firstOf(images));
    const grays = images.map((image) => toGray(samplePixels(image, ALIGN_EDGE)));
    const referenceIndex = Math.floor(images.length / 2);
    const reference = grays[referenceIndex];
    if (reference === undefined) throw new RangeError('No reference exposure');
    const scale = size.width / reference.width;
    const shifts: Shift[] = grays.map((gray, index) => {
      const shift = index === referenceIndex ? { dx: 0, dy: 0 } : alignShift(reference, gray);
      return { dx: Math.round(shift.dx * scale), dy: Math.round(shift.dy * scale) };
    });
    const area = commonArea(size.width, size.height, shifts);
    for (const [index, image] of images.entries()) {
      const shift = shifts[index] ?? { dx: 0, dy: 0 };
      const matrix = Skia.Matrix([1, 0, shift.dx - area.x, 0, 1, shift.dy - area.y, 0, 0, 1]);
      matrices.push(matrix);
      shaders.push(
        image.makeShaderOptions(
          TileMode.Clamp,
          TileMode.Clamp,
          FilterMode.Linear,
          MipmapMode.None,
          matrix,
        ),
      );
    }
    fusion ??= compileRuntimeEffect(
      Skia.RuntimeEffect,
      EXPOSURE_FUSION_SHADER_NAME,
      EXPOSURE_FUSION_SHADER_SOURCE,
    );
    const uniforms = {
      resolution: [area.width, area.height],
      count: images.length,
    } satisfies ExposureFusionUniforms;
    const [first, second, third] = shaders;
    if (first === undefined || second === undefined)
      throw new RangeError('Merge two or three exposures');
    const merged = fusion.makeShaderWithChildren(packUniforms(fusion, uniforms), [
      first,
      second,
      third ?? first,
    ]);
    const surface = makeSurface(area.width, area.height);
    const paint = Skia.Paint();
    try {
      paint.setShader(merged);
      surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, area.width, area.height), paint);
      surface.flush();
      return surface.makeImageSnapshot();
    } finally {
      paint.dispose();
      merged.dispose();
      surface.dispose();
    }
  } finally {
    for (const shader of shaders) shader.dispose();
    for (const matrix of matrices) matrix.dispose();
    for (const image of images) image.dispose();
  }
}

/**
 * Joins 2–6 shots of a pan from left to right into one wide photo (EDT-27): each
 * overlap is found on small copies, the shots are laid side by side and blended
 * across each overlap, and the result is cropped to the height all of them cover.
 */
export async function mergePanorama(uris: readonly string[], maxEdge: number): Promise<SkImage> {
  if (uris.length < 2) throw new RangeError('A panorama needs two shots or more');
  const images = await decodeAll(uris, maxEdge);
  try {
    const size = imageSize(firstOf(images));
    const grays = images.map((image) => toGray(samplePixels(image, PANORAMA_SAMPLE_EDGE)));
    const sampleScale = size.width / (grays[0]?.width ?? size.width);
    const offsets = grays.slice(1).map((gray, index) => {
      const offset = panoramaOffset(grays[index] ?? gray, gray);
      return { dx: Math.round(offset.dx * sampleScale), dy: Math.round(offset.dy * sampleScale) };
    });
    const layout = panoramaLayout(size, offsets);
    const fit = Math.min(1, MAX_PANORAMA_EDGE / Math.max(layout.width, layout.height));
    const width = Math.max(1, Math.round(layout.width * fit));
    const height = Math.max(1, Math.round(layout.height * fit));
    const surface = makeSurface(width, height);
    const fade = Skia.Paint();
    try {
      const canvas = surface.getCanvas();
      canvas.scale(fit, fit);
      canvas.translate(0, -layout.top);
      for (const [index, image] of images.entries()) {
        const position = layout.positions[index] ?? { dx: 0, dy: 0 };
        const previous = layout.positions[index - 1];
        canvas.save();
        canvas.translate(position.dx, position.dy);
        if (previous === undefined) {
          canvas.drawImage(image, 0, 0);
        } else {
          // Fade in across the overlap, so the seam is a soft blend, not a line.
          const overlap = Math.max(1, previous.dx + size.width - position.dx);
          const gradient = Skia.Shader.MakeLinearGradient(
            vec(0, 0),
            vec(overlap, 0),
            [Skia.Color('transparent'), Skia.Color('black')],
            null,
            TileMode.Clamp,
          );
          try {
            canvas.saveLayer();
            canvas.drawImage(image, 0, 0);
            fade.setShader(gradient);
            fade.setBlendMode(BlendMode.DstIn);
            canvas.drawRect(Skia.XYWHRect(0, 0, size.width, size.height), fade);
            canvas.restore();
          } finally {
            gradient.dispose();
          }
        }
        canvas.restore();
      }
      surface.flush();
      return surface.makeImageSnapshot();
    } finally {
      fade.dispose();
      surface.dispose();
    }
  } finally {
    for (const image of images) image.dispose();
  }
}

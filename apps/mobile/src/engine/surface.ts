import { Skia, type SkSurface } from '@shopify/react-native-skia';

/**
 * An offscreen surface for rendering photos and thumbnails: on the GPU when there
 * is one, otherwise on the CPU. Throws when even that fails (e.g. out of memory).
 */
export function makeSurface(width: number, height: number): SkSurface {
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (surface === null)
    throw new Error(`Failed to allocate a ${String(width)}x${String(height)} surface`);
  return surface;
}

import { createRequire } from 'node:module';

import CanvasKitInit, { type CanvasKit, type RuntimeEffect, type Shader } from 'canvaskit-wasm';

import { packUniforms, type LutImage, type UniformValues } from '../src';

/** Unpremultiplied RGBA8 pixels in row-major order. */
export interface Bitmap {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

type Rgba = readonly [number, number, number, number];

const require = createRequire(import.meta.url);
let canvasKit: Promise<CanvasKit> | undefined;

/** Loads the CanvasKit WebAssembly build once per test worker. */
export function loadCanvasKit(): Promise<CanvasKit> {
  canvasKit ??= CanvasKitInit({
    locateFile: (file) => require.resolve(`canvaskit-wasm/bin/${file}`),
  });
  return canvasKit;
}

export function createBitmap(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => Rgba,
): Bitmap {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.set(colorAt(x, y), (y * width + x) * 4);
    }
  }
  return { width, height, pixels };
}

export function pixelAt(bitmap: Bitmap, x: number, y: number): Rgba {
  const offset = (y * bitmap.width + x) * 4;
  const [r = 0, g = 0, b = 0, a = 0] = bitmap.pixels.subarray(offset, offset + 4);
  return [r, g, b, a];
}

export function uniformNames(effect: RuntimeEffect): string[] {
  return Array.from({ length: effect.getUniformCount() }, (_, i) => effect.getUniformName(i));
}

/** A child image of an effect; LUTs need linear filtering, photos are sampled exactly. */
export interface ChildImage {
  readonly bitmap: Bitmap;
  readonly filter?: 'nearest' | 'linear';
}

interface Disposable {
  delete(): void;
}

/**
 * Draws a shader built by `build` from child image shaders (the input first, then
 * `children`) on a CPU surface of the input's size, and frees everything afterwards.
 */
export function renderWith(
  ck: CanvasKit,
  input: Bitmap,
  build: (children: Shader[], track: <T extends Disposable>(object: T) => T) => Shader,
  children: ChildImage[] = [],
): Bitmap {
  const { width, height } = input;
  const info = (bitmap: Bitmap) => ({
    width: bitmap.width,
    height: bitmap.height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  });
  const disposables: Disposable[] = [];
  const track = <T extends Disposable>(object: T | null, what = 'object'): T => {
    if (object === null) throw new Error(`CanvasKit failed to create ${what}`);
    disposables.push(object);
    return object;
  };
  const imageShader = ({ bitmap, filter = 'nearest' }: ChildImage) => {
    const image = track(ck.MakeImage(info(bitmap), bitmap.pixels, bitmap.width * 4), 'image');
    return track(
      image.makeShaderOptions(
        ck.TileMode.Clamp,
        ck.TileMode.Clamp,
        filter === 'linear' ? ck.FilterMode.Linear : ck.FilterMode.Nearest,
        ck.MipmapMode.None,
      ),
      'image shader',
    );
  };

  try {
    const surface = track(ck.MakeSurface(width, height), 'surface');
    const shaders = [{ bitmap: input }, ...children].map(imageShader);
    const shader = track(
      build(shaders, (object) => track(object)),
      'shader',
    );
    const paint = track(new ck.Paint(), 'paint');
    paint.setShader(shader);
    surface.getCanvas().drawPaint(paint);

    const snapshot = track(surface.makeImageSnapshot(), 'snapshot');
    const pixels = snapshot.readPixels(0, 0, info(input));
    if (!(pixels instanceof Uint8Array)) throw new Error('CanvasKit failed to read pixels');
    return { width, height, pixels };
  } finally {
    // A shader may be tracked twice (e.g. returned by `build` and created inside it).
    new Set(disposables.reverse()).forEach((object) => {
      object.delete();
    });
  }
}

/** Draws `input` through `effect`, binding `input` and then `children` as child shaders. */
export function renderEffect(
  ck: CanvasKit,
  effect: RuntimeEffect,
  uniforms: UniformValues,
  input: Bitmap,
  children: readonly ChildImage[] = [],
): Bitmap {
  return renderWith(
    ck,
    input,
    (shaders) => effect.makeShaderWithChildren(packUniforms(effect, uniforms), shaders),
    [...children],
  );
}

export function maxChannelDifference(a: Bitmap, b: Bitmap): number {
  return a.pixels.reduce((max, value, i) => Math.max(max, Math.abs(value - (b.pixels[i] ?? 0))), 0);
}

export function luminance(bitmap: Bitmap, x: number, y: number): number {
  const [r, g, b] = pixelAt(bitmap, x, y);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A LUT image as a child bitmap. */
export function lutBitmap(lut: LutImage): ChildImage {
  return { bitmap: { width: lut.width, height: lut.height, pixels: lut.pixels }, filter: 'linear' };
}

import {
  chainFilters,
  compileFilterEffects,
  DEFAULT_ADJUST_PARAMS,
  DEFAULT_BODY_PARAMS,
  DEFAULT_DETAIL_PARAMS,
  DEFAULT_FACE_SHAPE_PARAMS,
  DEFAULT_LENS_PARAMS,
  DEFAULT_LIGHT_PARAMS,
  IDENTITY_LUT,
  toDateStampGlyphs,
  type BeautyParams,
  type FilmParams,
  type LutImage,
} from '@fant/filters';
import CanvasKitInit, {
  type CanvasKit,
  type Image,
  type Shader,
  type Surface,
} from 'canvaskit-wasm';
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url';

/**
 * Draws with CanvasKit (Skia on WebAssembly) and the app's own shader chain from
 * @fant/filters, so the studio shows what the app will (D-06, STU-01).
 */
export class StudioRenderer {
  private readonly effects;

  private constructor(readonly ck: CanvasKit) {
    this.effects = compileFilterEffects(ck.RuntimeEffect);
  }

  static async create(): Promise<StudioRenderer> {
    return new StudioRenderer(await CanvasKitInit({ locateFile: () => wasmUrl }));
  }

  decode(bytes: Uint8Array): Image {
    const image = this.ck.MakeImageFromEncoded(bytes);
    if (image === null) throw new Error('Could not read the image');
    return image;
  }

  lutImage(lut: LutImage): Image {
    const image = this.ck.MakeImage(
      {
        width: lut.width,
        height: lut.height,
        colorType: this.ck.ColorType.RGBA_8888,
        alphaType: this.ck.AlphaType.Unpremul,
        colorSpace: this.ck.ColorSpace.SRGB,
      },
      lut.pixels,
      lut.width * 4,
    );
    if (image === null) throw new Error('Could not create the LUT image');
    return image;
  }

  /** The LUT as PNG, the format the app loads (STU-03). */
  encodeLutPng(lut: LutImage): Uint8Array<ArrayBuffer> {
    const image = this.lutImage(lut);
    try {
      const png = image.encodeToBytes(this.ck.ImageFormat.PNG, 100);
      if (png === null) throw new Error('Could not encode the LUT');
      return new Uint8Array(png);
    } finally {
      image.delete();
    }
  }

  surfaceFor(canvas: HTMLCanvasElement): Surface {
    const surface = this.ck.MakeWebGLCanvasSurface(canvas) ?? this.ck.MakeSWCanvasSurface(canvas);
    if (surface === null) throw new Error('Could not draw on the canvas');
    return surface;
  }

  /**
   * Draws `image` scaled to fit the surface, through the film (or untouched when
   * `original` is set, for before/after comparison).
   */
  draw(
    surface: Surface,
    image: Image,
    look: {
      readonly film: FilmParams;
      readonly beauty: BeautyParams;
      readonly lut: { readonly image: Image; readonly size: number } | null;
      readonly seed: number;
      readonly original: boolean;
    },
  ): void {
    const { ck } = this;
    const canvas = surface.getCanvas();
    const width = surface.width();
    const height = surface.height();
    const scale = Math.min(width / image.width(), height / image.height());
    const drawn = {
      width: Math.round(image.width() * scale),
      height: Math.round(image.height() * scale),
    };
    const x = (width - drawn.width) / 2;
    const y = (height - drawn.height) / 2;
    const created: { delete(): void }[] = [];
    try {
      canvas.clear(ck.Color(20, 20, 24));
      canvas.save();
      canvas.translate(x, y);
      const source = image.makeShaderOptions(
        ck.TileMode.Clamp,
        ck.TileMode.Clamp,
        ck.FilterMode.Linear,
        ck.MipmapMode.None,
        ck.Matrix.scaled(scale, scale),
      );
      created.push(source);
      let shader: Shader = source;
      if (!look.original) {
        const identity = look.lut === null ? this.lutImage(IDENTITY_LUT) : null;
        if (identity !== null) created.push(identity);
        const lutImage = look.lut?.image ?? identity;
        if (lutImage === null) throw new Error('No LUT image');
        const lutShader = lutImage.makeShaderOptions(
          ck.TileMode.Clamp,
          ck.TileMode.Clamp,
          ck.FilterMode.Linear,
          ck.MipmapMode.None,
        );
        created.push(lutShader);
        const chain = chainFilters(
          this.effects,
          {
            lens: DEFAULT_LENS_PARAMS,
            faceShape: DEFAULT_FACE_SHAPE_PARAMS,
            body: DEFAULT_BODY_PARAMS,
            adjust: DEFAULT_ADJUST_PARAMS,
            beauty: look.beauty,
            detail: DEFAULT_DETAIL_PARAMS,
            local: [],
            light: DEFAULT_LIGHT_PARAMS,
            film: look.film,
            dateStamp: toDateStampGlyphs(null),
          },
          { width: drawn.width, height: drawn.height, seed: look.seed },
          source,
          { shader: lutShader, size: look.lut?.size ?? IDENTITY_LUT.size },
        );
        created.push(...chain.created);
        shader = chain.shader;
      }
      const paint = new ck.Paint();
      created.push(paint);
      paint.setShader(shader);
      canvas.drawRect(ck.XYWHRect(0, 0, drawn.width, drawn.height), paint);
      canvas.restore();
      surface.flush();
    } finally {
      for (const object of created.reverse()) object.delete();
    }
  }
}

/** A synthetic portrait (sky, skin, hair, a light) for when no photo is loaded. */
export function sampleImage(renderer: StudioRenderer): Image {
  const { ck } = renderer;
  const surface = ck.MakeSurface(600, 800);
  if (surface === null) throw new Error('Could not create the sample');
  const canvas = surface.getCanvas();
  const paint = new ck.Paint();
  const sky = ck.Shader.MakeLinearGradient(
    [0, 0],
    [0, 800],
    [
      ck.parseColorString('#7fb6e8'),
      ck.parseColorString('#f2c9a0'),
      ck.parseColorString('#5b4a6b'),
    ],
    [0, 0.55, 1],
    ck.TileMode.Clamp,
  );
  try {
    paint.setAntiAlias(true);
    paint.setShader(sky);
    canvas.drawRect(ck.XYWHRect(0, 0, 600, 800), paint);
    paint.setShader(null);
    paint.setColor(ck.parseColorString('#fff6d8'));
    canvas.drawCircle(480, 130, 60, paint);
    paint.setColor(ck.parseColorString('#2b1d1a'));
    canvas.drawOval(ck.XYWHRect(130, 240, 340, 500), paint);
    paint.setColor(ck.parseColorString('#e9b796'));
    canvas.drawOval(ck.XYWHRect(180, 300, 240, 320), paint);
    paint.setColor(ck.parseColorString('#ef8fa0'));
    canvas.drawOval(ck.XYWHRect(255, 530, 90, 30), paint);
    return surface.makeImageSnapshot();
  } finally {
    sky.delete();
    paint.delete();
    surface.delete();
  }
}

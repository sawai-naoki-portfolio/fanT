import { Skia, TileMode, vec } from '@shopify/react-native-skia';

import { encodeJpeg } from './photo';
import { makeSurface } from './surface';

const WIDTH = 1600;
const HEIGHT = 1200;
const HORIZON = 760;

/** A ridge across the photo: `peaks` are [x, y] points from left to right. */
function ridge(peaks: readonly (readonly [number, number])[], bottom: number) {
  const builder = Skia.PathBuilder.Make();
  try {
    builder.moveTo(0, bottom);
    for (const [x, y] of peaks) builder.lineTo(x, y);
    builder.lineTo(WIDTH, bottom);
    builder.close();
    return builder.build();
  } finally {
    builder.dispose();
  }
}

/**
 * Draws a simple landscape (sky, sun, mountains, a lake) for developer builds, so
 * the editor can be tried, and screenshotted, on a simulator without a camera or
 * photo library.
 */
export function sampleLandscapeJpeg(): Uint8Array {
  const surface = makeSurface(WIDTH, HEIGHT);
  const paint = Skia.Paint();
  const shaders = [
    Skia.Shader.MakeLinearGradient(
      vec(0, 0),
      vec(0, HORIZON),
      [Skia.Color('#3d6fb6'), Skia.Color('#9cc4e8'), Skia.Color('#f6d7b0')],
      [0, 0.7, 1],
      TileMode.Clamp,
    ),
    Skia.Shader.MakeLinearGradient(
      vec(0, HORIZON),
      vec(0, HEIGHT),
      [Skia.Color('#6f9cc7'), Skia.Color('#1f3f62')],
      null,
      TileMode.Clamp,
    ),
  ];
  const [sky, lake] = shaders;
  const far = ridge(
    [
      [0, 560],
      [260, 430],
      [520, 540],
      [800, 380],
      [1100, 520],
      [1350, 420],
      [1600, 560],
    ],
    HORIZON,
  );
  const near = ridge(
    [
      [0, 680],
      [300, 600],
      [640, 700],
      [980, 590],
      [1300, 690],
      [1600, 620],
    ],
    HORIZON,
  );
  try {
    const canvas = surface.getCanvas();
    if (sky === undefined || lake === undefined) throw new Error('Missing gradients');
    paint.setShader(sky);
    canvas.drawRect(Skia.XYWHRect(0, 0, WIDTH, HORIZON), paint);
    paint.setShader(lake);
    canvas.drawRect(Skia.XYWHRect(0, HORIZON, WIDTH, HEIGHT - HORIZON), paint);
    paint.setShader(null);
    paint.setColor(Skia.Color('#fff4d6'));
    canvas.drawCircle(1180, 300, 70, paint);
    paint.setColor(Skia.Color('#5b6f8c'));
    canvas.drawPath(far, paint);
    paint.setColor(Skia.Color('#2f4a3a'));
    canvas.drawPath(near, paint);
    surface.flush();
    const image = surface.makeImageSnapshot();
    try {
      return encodeJpeg(image);
    } finally {
      image.dispose();
    }
  } finally {
    for (const shader of shaders) shader.dispose();
    far.dispose();
    near.dispose();
    paint.dispose();
    surface.dispose();
  }
}

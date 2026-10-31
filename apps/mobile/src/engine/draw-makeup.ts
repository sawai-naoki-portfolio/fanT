import {
  BlendMode,
  ClipOp,
  BlurStyle,
  Skia,
  TileMode,
  vec,
  type SkCanvas,
  type SkPaint,
} from '@shopify/react-native-skia';

import type { FaceGeometry } from '../features/character/face-geometry.worklet';
import type { Makeup } from '../features/makeup/makeup';
import type { Point } from './affine.worklet';

function pathOf(points: readonly Point[]) {
  'worklet';
  const builder = Skia.PathBuilder.Make();
  const [first, ...rest] = points;
  if (first !== undefined) {
    builder.moveTo(first.x, first.y);
    for (const point of rest) builder.lineTo(point.x, point.y);
    builder.close();
  }
  const path = builder.build();
  builder.dispose();
  return path;
}

/** Fills an outline with a colour blended into the skin, its edge softened. */
function tint(
  canvas: SkCanvas,
  points: readonly Point[],
  color: string,
  opacity: number,
  blend: BlendMode,
  softness: number,
): void {
  'worklet';
  const path = pathOf(points);
  const paint = Skia.Paint();
  const blur = Skia.MaskFilter.MakeBlur(BlurStyle.Normal, Math.max(0.5, softness), true);
  try {
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(color));
    paint.setAlphaf(opacity);
    paint.setBlendMode(blend);
    paint.setMaskFilter(blur);
    canvas.drawPath(path, paint);
  } finally {
    blur.dispose();
    paint.dispose();
    path.dispose();
  }
}

/** A soft round glow of colour (blush, under-eye light). */
function glow(
  canvas: SkCanvas,
  center: Point,
  radius: number,
  color: string,
  opacity: number,
  blend: BlendMode,
): void {
  'worklet';
  const paint: SkPaint = Skia.Paint();
  const shader = Skia.Shader.MakeRadialGradient(
    vec(center.x, center.y),
    radius,
    [Skia.Color(color), Skia.Color('transparent')],
    [0, 1],
    TileMode.Clamp,
  );
  try {
    paint.setAntiAlias(true);
    paint.setShader(shader);
    paint.setAlphaf(opacity);
    paint.setBlendMode(blend);
    canvas.drawCircle(center.x, center.y, radius, paint);
  } finally {
    shader.dispose();
    paint.dispose();
  }
}

function centreOf(points: readonly Point[]): Point {
  'worklet';
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / Math.max(1, points.length), y: y / Math.max(1, points.length) };
}

/** An eye outline stretched upwards: where eyeshadow goes (above the lash line). */
function lidOf(eye: readonly Point[], lift: number): Point[] {
  'worklet';
  const centre = centreOf(eye);
  return eye.map((point) => ({
    x: centre.x + (point.x - centre.x) * 1.15,
    y: point.y < centre.y ? point.y - lift : centre.y + (point.y - centre.y) * 0.2,
  }));
}

/**
 * Makeup and touch-ups on each face (BTY-07/09/10), drawn over the retouched photo
 * and under the film look so they take on its colours. Faces without outlines get
 * only what landmarks allow (blush, under-eye). Marked as a worklet so it can run on
 * the camera thread; every Skia object is disposed before returning.
 */
export function drawMakeup(canvas: SkCanvas, makeup: Makeup, faces: readonly FaceGeometry[]): void {
  'worklet';
  for (const face of faces) {
    const soft = face.width * 0.012;
    const outline = face.outline;
    const eyes = face.eyes;
    const span =
      eyes === null ? face.width * 0.4 : Math.hypot(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y);

    if (makeup.underEye > 0 && eyes !== null) {
      for (const eye of eyes) {
        glow(
          canvas,
          { x: eye.x, y: eye.y + span * 0.22 },
          span * 0.24,
          '#f6dccb',
          makeup.underEye * 0.45,
          BlendMode.Screen,
        );
      }
    }
    if (makeup.blush > 0) {
      const cheeks =
        face.cheeks ??
        (eyes === null
          ? null
          : ([
              { x: eyes[0].x - span * 0.05, y: eyes[0].y + span * 0.55 },
              { x: eyes[1].x + span * 0.05, y: eyes[1].y + span * 0.55 },
            ] as const));
      if (cheeks !== null) {
        for (const cheek of cheeks) {
          glow(
            canvas,
            cheek,
            span * 0.38,
            makeup.blushColor,
            makeup.blush * 0.5,
            BlendMode.Multiply,
          );
        }
      }
    }
    if (outline === null) continue;
    if (makeup.brow > 0 && outline.brows !== null) {
      for (const brow of outline.brows) {
        tint(canvas, brow, makeup.browColor, makeup.brow * 0.55, BlendMode.Multiply, soft);
      }
    }
    if (makeup.eyeshadow > 0 && outline.eyes !== null) {
      for (const eye of outline.eyes) {
        tint(
          canvas,
          lidOf(eye, span * 0.16),
          makeup.eyeshadowColor,
          makeup.eyeshadow * 0.45,
          BlendMode.Multiply,
          soft * 3,
        );
      }
    }
    if (makeup.lens > 0 && outline.eyes !== null) {
      for (const eye of outline.eyes) {
        // The iris sits in the middle of the eye opening; clip to the opening.
        const centre = centreOf(eye);
        const path = pathOf(eye);
        canvas.save();
        canvas.clipPath(path, ClipOp.Intersect, true);
        glow(canvas, centre, span * 0.13, makeup.lensColor, makeup.lens * 0.8, BlendMode.Color);
        canvas.restore();
        path.dispose();
      }
    }
    if (makeup.lip > 0 && outline.lips !== null) {
      tint(canvas, outline.lips, makeup.lipColor, makeup.lip * 0.6, BlendMode.Multiply, soft);
    }
    if (makeup.teeth > 0 && outline.mouth !== null) {
      // Less yellow (towards grey) and a little brighter.
      tint(canvas, outline.mouth, '#808080', makeup.teeth * 0.6, BlendMode.Saturation, soft * 0.5);
      tint(canvas, outline.mouth, '#ffffff', makeup.teeth * 0.15, BlendMode.Screen, soft * 0.5);
    }
  }
}

import type { Stamp } from '@fant/content-schema';
import {
  BlendMode,
  BlurStyle,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkImage,
  type SkPath,
  type SkPicture,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import type { DecoLayer, DecoStroke } from '../features/photo/recipe';
import { drawImageCentered } from './draw-image';
import { drawShape } from './draw-shape';
import { drawStyledText } from './draw-text';
import { STAMP_SHAPE_ART } from './shapes';

export interface DecoAssets {
  readonly stamps: ReadonlyMap<string, Stamp>;
  /** Decoded image stamps by asset hash. */
  readonly images: Readonly<Record<string, SkImage>>;
  /** Bundled fonts for text (DCO-06); text uses the system font without them. */
  readonly fonts?: SkTypefaceFontProvider | null;
}

/** For drawing strokes alone (masks, painted areas): no stamps, images or fonts. */
export const NO_DECO_ASSETS: DecoAssets = { stamps: new Map(), images: {} };

/** A smooth path through the stroke's points (quadratic curves through midpoints). */
function strokePath(stroke: DecoStroke, width: number, height: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  const { points } = stroke;
  const at = (index: number) => ({
    x: (points[index * 2] ?? 0) * width,
    y: (points[index * 2 + 1] ?? 0) * height,
  });
  const count = points.length / 2;
  const first = at(0);
  try {
    builder.moveTo(first.x, first.y);
    for (let i = 1; i < count - 1; i++) {
      const current = at(i);
      const next = at(i + 1);
      builder.quadTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    const last = at(count - 1);
    // A tap leaves a single point: extend it a hair so the round cap draws a dot.
    builder.lineTo(count === 1 ? last.x + 0.01 : last.x, last.y);
    return builder.build();
  } finally {
    builder.dispose();
  }
}

function drawStroke(canvas: SkCanvas, stroke: DecoStroke, width: number, height: number): void {
  const shortEdge = Math.min(width, height);
  const lineWidth = stroke.width * shortEdge;
  const path = strokePath(stroke, width, height);
  const paint = Skia.Paint();
  const blur =
    stroke.tool === 'neon'
      ? Skia.MaskFilter.MakeBlur(BlurStyle.Normal, lineWidth * 0.8, true)
      : null;
  try {
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setStrokeWidth(lineWidth);
    if (stroke.tool === 'eraser') {
      paint.setBlendMode(BlendMode.Clear);
      canvas.drawPath(path, paint);
      return;
    }
    paint.setColor(Skia.Color(stroke.color));
    if (blur !== null) {
      // Neon (DCO-01): a coloured glow around a bright core.
      paint.setMaskFilter(blur);
      paint.setStrokeWidth(lineWidth * 1.6);
      canvas.drawPath(path, paint);
      const core = Skia.Paint();
      try {
        core.setAntiAlias(true);
        core.setStyle(PaintStyle.Stroke);
        core.setStrokeCap(StrokeCap.Round);
        core.setStrokeJoin(StrokeJoin.Round);
        core.setStrokeWidth(lineWidth * 0.45);
        core.setColor(Skia.Color('#ffffff'));
        canvas.drawPath(path, core);
      } finally {
        core.dispose();
      }
      return;
    }
    canvas.drawPath(path, paint);
  } finally {
    paint.dispose();
    path.dispose();
    blur?.dispose();
  }
}

function drawLayer(
  canvas: SkCanvas,
  layer: DecoLayer,
  width: number,
  height: number,
  assets: DecoAssets,
): void {
  if (layer.type === 'stroke') {
    drawStroke(canvas, layer, width, height);
    return;
  }
  const shortEdge = Math.min(width, height);
  const center = { x: layer.x * width, y: layer.y * height };
  const size = layer.size * shortEdge;
  if (layer.type === 'text') {
    drawStyledText(
      canvas,
      layer.text,
      layer.style,
      layer.color,
      { center, fontSize: size, rotation: layer.rotation },
      { font: layer.font, fonts: assets.fonts ?? null },
    );
    return;
  }
  const stamp = assets.stamps.get(layer.stampId);
  if (stamp === undefined) return;
  const { art } = stamp;
  if (art.type === 'shape') {
    drawShape(canvas, STAMP_SHAPE_ART[art.shape], layer.color ?? art.color, {
      center,
      size,
      rotation: layer.rotation,
      mirrored: false,
    });
  } else if (art.type === 'text') {
    drawStyledText(canvas, art.text, art.style, layer.color ?? art.color, {
      center,
      fontSize: size * 0.45,
      rotation: layer.rotation,
    });
  } else {
    const image = assets.images[art.image.sha256];
    if (image !== undefined)
      drawImageCentered(canvas, image, { center, size, rotation: layer.rotation, mirrored: false });
  }
}

/**
 * Draws the decorations (DCO-01–05) over a photo of `width`×`height`, in their own
 * layer so the eraser removes decorations but never the photo underneath.
 */
export function drawDeco(
  canvas: SkCanvas,
  layers: readonly DecoLayer[],
  width: number,
  height: number,
  assets: DecoAssets,
): void {
  if (layers.length === 0) return;
  canvas.saveLayer();
  try {
    for (const layer of layers) drawLayer(canvas, layer, width, height, assets);
  } finally {
    canvas.restore();
  }
}

/**
 * Records decorations as a picture for the editor's overlay, plus a ring around the
 * selected layer. Drawn in the photo's full-resolution coordinates.
 */
export function recordDeco(
  layers: readonly DecoLayer[],
  width: number,
  height: number,
  assets: DecoAssets,
  selection: { readonly x: number; readonly y: number; readonly radius: number } | null,
): SkPicture {
  const recorder = Skia.PictureRecorder();
  try {
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawDeco(canvas, layers, width, height, assets);
    if (selection !== null) {
      const ring = Skia.Paint();
      try {
        ring.setAntiAlias(true);
        ring.setStyle(PaintStyle.Stroke);
        ring.setStrokeWidth(Math.max(2, Math.min(width, height) * 0.004));
        ring.setColor(Skia.Color('rgba(255, 255, 255, 0.9)'));
        canvas.drawCircle(selection.x, selection.y, selection.radius, ring);
      } finally {
        ring.dispose();
      }
    }
    return recorder.finishRecordingAsPicture();
  } finally {
    recorder.dispose();
  }
}

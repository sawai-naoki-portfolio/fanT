import { PaintStyle, Skia, StrokeCap, type SkCanvas } from '@shopify/react-native-skia';

import type { Size } from '../features/photo/geometry';
import type { Frame, Rect } from '../features/photo/frames';
import { drawShape } from './draw-shape';
import { drawStyledText } from './draw-text';
import { STAMP_SHAPE_ART } from './shapes';

/** Instant-print paper: warm white, not pure white. */
const PAPER = '#fbf8f3';
/** The digicam read-out: white with a dark glow so it reads on any photo. */
const LCD_SHADOW = '#000000';
const LCD_WHITE = '#ffffff';

/** The frame's paper or colour, drawn before the photo (FLM-07, PRI-08). */
export function drawFrameBackground(canvas: SkCanvas, frame: Frame | null, size: Size): void {
  if (frame === null || frame.type === 'digicam') return;
  const paint = Skia.Paint();
  try {
    paint.setColor(Skia.Color(frame.type === 'oshi' ? frame.color : PAPER));
    canvas.drawRect(Skia.XYWHRect(0, 0, size.width, size.height), paint);
  } finally {
    paint.dispose();
  }
}

/** What goes over the photo: the print's edge, oshi hearts or the LCD read-out. */
export function drawFrameOverlay(
  canvas: SkCanvas,
  frame: Frame | null,
  size: Size,
  photo: Rect,
  seed: number,
): void {
  if (frame === null) return;
  const short = Math.min(size.width, size.height);
  if (frame.type === 'polaroid') drawPrintEdge(canvas, photo, short);
  else if (frame.type === 'oshi') drawOshiHearts(canvas, size, photo, short);
  else drawDigicamReadout(canvas, size, short, seed);
}

function drawPrintEdge(canvas: SkCanvas, photo: Rect, short: number): void {
  const paint = Skia.Paint();
  try {
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(Math.max(1, short * 0.002));
    paint.setColor(Skia.Color('rgba(0, 0, 0, 0.12)'));
    canvas.drawRect(Skia.XYWHRect(photo.x, photo.y, photo.width, photo.height), paint);
  } finally {
    paint.dispose();
  }
}

/** White hearts in the corners and sparkles along the edges of the oshi border. */
function drawOshiHearts(canvas: SkCanvas, size: Size, photo: Rect, short: number): void {
  const border = photo.x;
  const heart = border * 1.9;
  const corners = [
    { x: border, y: border, rotation: -20 },
    { x: size.width - border, y: border, rotation: 20 },
    { x: border, y: size.height - border, rotation: 20 },
    { x: size.width - border, y: size.height - border, rotation: -20 },
  ];
  for (const { x, y, rotation } of corners) {
    drawShape(canvas, STAMP_SHAPE_ART.heart, '#ffffff', {
      center: { x, y },
      size: heart,
      rotation,
      mirrored: false,
    });
  }
  const sparkle = border * 0.8;
  const step = short * 0.22;
  for (let x = step; x < size.width - step / 2; x += step) {
    for (const y of [border / 2, size.height - border / 2]) {
      drawShape(canvas, STAMP_SHAPE_ART.sparkle, '#ffffff', {
        center: { x, y },
        size: sparkle,
        rotation: 0,
        mirrored: false,
      });
    }
  }
}

/**
 * A Heisei digicam's LCD: focus brackets, a battery, the mode and the shots left
 * (from the seed, so every render of a photo shows the same number).
 */
function drawDigicamReadout(canvas: SkCanvas, size: Size, short: number, seed: number): void {
  const inset = short * 0.06;
  const arm = short * 0.07;
  const line = Math.max(2, short * 0.006);
  const paint = Skia.Paint();
  const shadow = Skia.Paint();
  try {
    for (const target of [shadow, paint]) {
      target.setAntiAlias(true);
      target.setStyle(PaintStyle.Stroke);
      target.setStrokeCap(StrokeCap.Round);
    }
    paint.setStrokeWidth(line);
    paint.setColor(Skia.Color(LCD_WHITE));
    shadow.setStrokeWidth(line * 2.2);
    shadow.setColor(Skia.Color('rgba(0, 0, 0, 0.35)'));

    const brackets = Skia.PathBuilder.Make();
    const corners: readonly [number, number, number, number][] = [
      [inset, inset, 1, 1],
      [size.width - inset, inset, -1, 1],
      [inset, size.height - inset, 1, -1],
      [size.width - inset, size.height - inset, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      brackets.moveTo(x + dx * arm, y);
      brackets.lineTo(x, y);
      brackets.lineTo(x, y + dy * arm);
    }
    const battery = Skia.PathBuilder.Make();
    const width = short * 0.09;
    const height = width * 0.45;
    const left = size.width - inset * 1.4 - width;
    const top = inset * 1.4;
    battery.addRect(Skia.XYWHRect(left, top, width, height));
    battery.addRect(Skia.XYWHRect(left + width, top + height * 0.3, width * 0.08, height * 0.4));
    for (let bar = 0; bar < 3; bar++) {
      const x = left + width * (0.2 + bar * 0.28);
      battery.moveTo(x, top + height * 0.25);
      battery.lineTo(x, top + height * 0.75);
    }
    for (const builder of [brackets, battery]) {
      const path = builder.build();
      builder.dispose();
      canvas.drawPath(path, shadow);
      canvas.drawPath(path, paint);
      path.dispose();
    }
  } finally {
    paint.dispose();
    shadow.dispose();
  }

  const fontSize = short * 0.045;
  const shotsLeft = String(100 + Math.floor(seed * 800)).padStart(4, '0');
  drawStyledText(canvas, 'P  ★', 'neon', LCD_SHADOW, {
    center: { x: inset * 1.4 + fontSize * 1.2, y: inset * 1.4 + fontSize * 0.5 },
    fontSize,
    rotation: 0,
  });
  drawStyledText(canvas, shotsLeft, 'neon', LCD_SHADOW, {
    center: { x: inset * 1.4 + fontSize * 1.3, y: size.height - inset * 1.4 - fontSize * 0.6 },
    fontSize,
    rotation: 0,
  });
}

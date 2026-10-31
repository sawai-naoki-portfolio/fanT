import type { TextStampStyle } from '@fant/content-schema';
import {
  FontWeight,
  PaintStyle,
  Skia,
  StrokeJoin,
  TextAlign,
  type SkCanvas,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import { DECO_FONT_FAMILIES, type DecoFont } from '../features/deco/deco-fonts';

import type { Point } from './affine.worklet';

export interface TextPlacement {
  readonly center: Point;
  /** Font size in pixels. */
  readonly fontSize: number;
  /** Degrees, clockwise. */
  readonly rotation: number;
}

/** A bundled font (DCO-06) and the loaded fonts to find it in. */
export interface TextFont {
  readonly font: DecoFont;
  readonly fonts: SkTypefaceFontProvider | null;
}

/**
 * Heisei-style text (DCO-03, text stamps): a bold outline (gyaru-moji), a glowing
 * neon or a speech bubble, in the system font or a bundled one. Skia's paragraph
 * layout falls back per glyph, so Japanese and emoji always render.
 */
export function drawStyledText(
  canvas: SkCanvas,
  text: string,
  style: TextStampStyle,
  color: string,
  placement: TextPlacement,
  font: TextFont = { font: 'system', fonts: null },
): void {
  const { fontSize } = placement;
  const family =
    font.font === 'system' || font.fonts === null ? null : DECO_FONT_FAMILIES[font.font];
  const layoutWidth = fontSize * Math.max(4, text.length * 1.4);
  const disposables: { dispose(): void }[] = [];
  const paragraphWith = (foreground: ReturnType<typeof Skia.Paint>) => {
    const builder = Skia.ParagraphBuilder.Make(
      { textAlign: TextAlign.Center },
      family === null ? undefined : (font.fonts ?? undefined),
    );
    builder.pushStyle(
      {
        fontSize,
        ...(family === null
          ? { fontStyle: { weight: FontWeight.ExtraBold } }
          : { fontFamilies: [family] }),
        shadows:
          style === 'neon'
            ? [
                { color: Skia.Color(color), blurRadius: fontSize * 0.35 },
                { color: Skia.Color(color), blurRadius: fontSize * 0.12 },
              ]
            : [],
      },
      foreground,
    );
    builder.addText(text);
    const paragraph = builder.build();
    paragraph.layout(layoutWidth);
    return paragraph;
  };

  try {
    canvas.save();
    canvas.translate(placement.center.x, placement.center.y);
    canvas.rotate(placement.rotation, 0, 0);

    const fill = Skia.Paint();
    disposables.push(fill);
    fill.setAntiAlias(true);
    fill.setColor(Skia.Color(style === 'neon' ? '#ffffff' : color));
    const main = paragraphWith(fill);
    disposables.push(main);
    const height = main.getHeight();
    const textWidth = main.getLongestLine();
    const x = -layoutWidth / 2;
    const y = -height / 2;

    if (style === 'bubble') {
      const background = Skia.Paint();
      disposables.push(background);
      background.setAntiAlias(true);
      background.setColor(Skia.Color('#ffffff'));
      const padding = fontSize * 0.4;
      canvas.drawRRect(
        Skia.RRectXY(
          Skia.XYWHRect(
            -textWidth / 2 - padding,
            y - padding * 0.5,
            textWidth + padding * 2,
            height + padding,
          ),
          fontSize * 0.6,
          fontSize * 0.6,
        ),
        background,
      );
    }
    if (style === 'outline') {
      const stroke = Skia.Paint();
      disposables.push(stroke);
      stroke.setAntiAlias(true);
      stroke.setStyle(PaintStyle.Stroke);
      stroke.setStrokeJoin(StrokeJoin.Round);
      stroke.setStrokeWidth(fontSize * 0.22);
      stroke.setColor(Skia.Color('#ffffff'));
      const outline = paragraphWith(stroke);
      disposables.push(outline);
      outline.paint(canvas, x, y);
    }
    main.paint(canvas, x, y);
    canvas.restore();
  } finally {
    for (const object of disposables) object.dispose();
  }
}

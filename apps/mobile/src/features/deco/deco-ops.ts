import type { Size } from '../photo/geometry';
import {
  MAX_DECO_LAYERS,
  MAX_STROKE_POINTS,
  type DecoLayer,
  type DecoStamp,
  type DecoStroke,
  type DecoText,
} from '../photo/recipe';

export type PlacedLayer = DecoStamp | DecoText;

/** Pen colours (DCO-01): Heisei neon and pastel. */
export const DECO_COLORS = [
  '#ffffff',
  '#ff5fa2',
  '#ff3b5c',
  '#ffd93b',
  '#7ad94b',
  '#39f3ff',
  '#5aa9ff',
  '#b26bff',
  '#2b2b2e',
] as const;

/** Pen widths as fractions of the photo's short edge. */
export const PEN_WIDTHS = [0.008, 0.016, 0.03] as const;

/** Points closer than this (in photo fractions) are not added to a stroke. */
const MIN_POINT_DISTANCE = 0.003;

/** Starts a stroke at a point (photo fractions). */
export function startStroke(
  tool: DecoStroke['tool'],
  color: string,
  width: number,
  x: number,
  y: number,
): DecoStroke {
  return { type: 'stroke', tool, color, width, points: [x, y, x, y] };
}

/** Extends a stroke, skipping points too close to the last one and capping its length. */
export function extendStroke(stroke: DecoStroke, x: number, y: number): DecoStroke {
  const { points } = stroke;
  const lastX = points[points.length - 2] ?? x;
  const lastY = points[points.length - 1] ?? y;
  if (
    Math.hypot(x - lastX, y - lastY) < MIN_POINT_DISTANCE ||
    points.length / 2 >= MAX_STROKE_POINTS
  )
    return stroke;
  return { ...stroke, points: [...points, x, y] };
}

/** Where a placed layer is on the photo, in pixels, with a radius for touches. */
function layerCircle(layer: PlacedLayer, size: Size) {
  const shortEdge = Math.min(size.width, size.height);
  const extent =
    layer.type === 'text' ? layer.size * Math.max(1, layer.text.length * 0.6) : layer.size;
  return { x: layer.x * size.width, y: layer.y * size.height, radius: (extent * shortEdge) / 2 };
}

/** The topmost stamp or text under a point (photo pixels), or `null`. */
export function hitTest(
  layers: readonly DecoLayer[],
  point: { readonly x: number; readonly y: number },
  size: Size,
): number | null {
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index];
    if (layer === undefined || layer.type === 'stroke') continue;
    const circle = layerCircle(layer, size);
    // A little slack so small stamps stay easy to grab.
    if (Math.hypot(point.x - circle.x, point.y - circle.y) <= Math.max(circle.radius, 24))
      return index;
  }
  return null;
}

export interface LayerChange {
  /** Movement in photo fractions. */
  readonly dx: number;
  readonly dy: number;
  /** Multiplier for the size. */
  readonly scale: number;
  /** Degrees to add. */
  readonly rotation: number;
}

/** Moves, scales and rotates a stamp or text (DCO-02), keeping it within the schema's limits. */
export function transformLayer<T extends PlacedLayer>(layer: T, change: LayerChange): T {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const rotation = ((layer.rotation + change.rotation + 540) % 360) - 180;
  return {
    ...layer,
    x: clamp(layer.x + change.dx, -0.4, 1.4),
    y: clamp(layer.y + change.dy, -0.4, 1.4),
    size: clamp(layer.size * change.scale, 0.03, 1.5),
    rotation,
  };
}

/** Replaces one layer, or removes it with `null`. */
/** The layers with one more, or `null` when the photo already has as many as a recipe holds. */
export function addLayer(layers: readonly DecoLayer[], layer: DecoLayer): DecoLayer[] | null {
  return layers.length >= MAX_DECO_LAYERS ? null : [...layers, layer];
}

export function replaceLayer(
  layers: readonly DecoLayer[],
  index: number,
  layer: DecoLayer | null,
): DecoLayer[] {
  return layer === null
    ? layers.filter((_, i) => i !== index)
    : layers.map((current, i) => (i === index ? layer : current));
}

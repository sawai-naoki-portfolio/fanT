import { useRef } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { extendStroke, startStroke } from '../deco/deco-ops';
import type { DecoStroke } from '../photo/recipe';

/** How painted areas are shown while painting. */
export const BRUSH_COLOR = '#ff5fa2';

/**
 * Painting over the shown photo (EDT-35): each drag becomes a stroke in photo
 * fractions, handed over when the finger lifts.
 */
export function BrushLayer({
  rect,
  width,
  onStroke,
}: {
  readonly rect: LayoutRectangle | null;
  /** Line width as a fraction of the photo's short edge. */
  readonly width: number;
  readonly onStroke: (stroke: DecoStroke) => void;
}) {
  const stroke = useRef<DecoStroke | null>(null);
  const toPhoto = (x: number, y: number) =>
    rect === null ? null : { x: x / rect.width, y: y / rect.height };
  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    minDistance: 0,
    onBegin: (event) => {
      const point = toPhoto(event.x, event.y);
      stroke.current =
        point === null ? null : startStroke('pen', BRUSH_COLOR, width, point.x, point.y);
    },
    onUpdate: (event) => {
      const point = toPhoto(event.x, event.y);
      if (point !== null && stroke.current !== null) {
        stroke.current = extendStroke(stroke.current, point.x, point.y);
      }
    },
    onFinalize: () => {
      if (stroke.current !== null) onStroke(stroke.current);
      stroke.current = null;
    },
  });
  if (rect === null) return null;
  return (
    <GestureDetector gesture={pan}>
      <View
        style={[
          styles.layer,
          { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
        ]}
      />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
});

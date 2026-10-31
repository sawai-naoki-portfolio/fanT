import { Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';

import { colors } from '../../ui/theme';
import type { PhotoPoint } from './panels/panel-props';

/**
 * A marker on the photo: a ring of `radius` (fraction of the photo's short edge),
 * or for a graduated filter a line across the photo.
 */
export interface PhotoMarker {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly selected?: boolean;
  /** A graduated filter's direction (degrees clockwise from up): drawn as its middle line. */
  readonly line?: number;
}

/**
 * Turns taps on the shown photo into photo fractions for tools that place things
 * (local areas, blemish spots, the leg line) and draws their markers.
 */
export function PhotoTapLayer({
  rect,
  markers,
  onTap,
}: {
  readonly rect: LayoutRectangle | null;
  readonly markers: readonly PhotoMarker[];
  readonly onTap: ((point: PhotoPoint) => void) | null;
}) {
  if (rect === null) return null;
  const short = Math.min(rect.width, rect.height);
  return (
    <Pressable
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      disabled={onTap === null}
      style={[styles.layer, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]}
      onPress={(event) => {
        const { locationX, locationY } = event.nativeEvent;
        onTap?.({ x: locationX / rect.width, y: locationY / rect.height });
      }}
    >
      {markers.map((marker, index) => {
        if (marker.line !== undefined) {
          // Long enough to cross the photo at any angle.
          const length = Math.hypot(rect.width, rect.height) * 2;
          return (
            <View
              key={String(index)}
              pointerEvents="none"
              style={[
                styles.line,
                marker.selected === true && styles.selected,
                {
                  left: marker.x * rect.width - length / 2,
                  top: marker.y * rect.height,
                  width: length,
                  transform: [{ rotate: `${String(marker.line)}deg` }],
                },
              ]}
            />
          );
        }
        const size = marker.radius * short * 2;
        return (
          <View
            key={String(index)}
            pointerEvents="none"
            style={[
              styles.marker,
              marker.selected === true && styles.selected,
              {
                left: marker.x * rect.width - size / 2,
                top: marker.y * rect.height - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          />
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Lines of graduated filters reach past the photo; it shows only its own part.
  layer: { position: 'absolute', overflow: 'hidden' },
  marker: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.onPhoto,
  },
  line: {
    position: 'absolute',
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.onPhoto,
  },
  selected: { borderColor: colors.accent, borderStyle: 'solid' },
});

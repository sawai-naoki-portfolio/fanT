import { useRef } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { strings } from '../../i18n';
import { colors } from '../../ui/theme';
import { CROP_CORNERS, dragCorner, moveCrop, type CropCorner } from '../photo/crop-ops';
import type { Crop } from '../photo/recipe';

const HANDLE = 28;

/** A draggable part of the frame: a corner, or the inside to move it. */
function useDrag(
  rect: LayoutRectangle,
  crop: Crop,
  onChange: (crop: Crop) => void,
  apply: (start: Crop, dx: number, dy: number) => Crop,
) {
  const start = useRef(crop);
  return usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: () => {
      start.current = crop;
    },
    onUpdate: (event) => {
      onChange(
        apply(start.current, event.translationX / rect.width, event.translationY / rect.height),
      );
    },
  });
}

function Corner({
  corner,
  rect,
  crop,
  onChange,
}: {
  readonly corner: CropCorner;
  readonly rect: LayoutRectangle;
  readonly crop: Crop;
  readonly onChange: (crop: Crop) => void;
}) {
  const pan = useDrag(rect, crop, onChange, (start, dx, dy) => dragCorner(start, corner, dx, dy));
  const right = corner === 'topRight' || corner === 'bottomRight';
  const bottom = corner === 'bottomLeft' || corner === 'bottomRight';
  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityLabel={strings.edit.cropCorners[corner]}
        style={[
          styles.handle,
          {
            left: (crop.x + (right ? crop.width : 0)) * rect.width - HANDLE / 2,
            top: (crop.y + (bottom ? crop.height : 0)) * rect.height - HANDLE / 2,
          },
        ]}
      />
    </GestureDetector>
  );
}

/**
 * Free cropping over the whole photo (EDT-29): drag a corner to resize, or the
 * inside to move. `rect` is where the photo is shown.
 */
export function CropFrame({
  rect,
  crop,
  onChange,
}: {
  readonly rect: LayoutRectangle | null;
  readonly crop: Crop;
  readonly onChange: (crop: Crop) => void;
}) {
  const inside = useDrag(rect ?? { x: 0, y: 0, width: 1, height: 1 }, crop, onChange, moveCrop);
  if (rect === null) return null;
  const left = crop.x * rect.width;
  const top = crop.y * rect.height;
  const width = crop.width * rect.width;
  const height = crop.height * rect.height;
  // What is cropped away is shaded: above, below, and either side of the frame.
  const shades = [
    { left: 0, top: 0, width: rect.width, height: top },
    { left: 0, top: top + height, width: rect.width, height: rect.height - top - height },
    { left: 0, top, width: left, height },
    { left: left + width, top, width: rect.width - left - width, height },
  ];
  return (
    <View
      style={[styles.layer, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]}
    >
      {shades.map((shade, index) => (
        <View key={String(index)} pointerEvents="none" style={[styles.shade, shade]} />
      ))}
      <GestureDetector gesture={inside}>
        <View
          accessibilityLabel={strings.edit.cropMove}
          style={[styles.frame, { left, top, width, height }]}
        />
      </GestureDetector>
      {CROP_CORNERS.map((corner) => (
        <Corner key={corner} corner={corner} rect={rect} crop={crop} onChange={onChange} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
  shade: { position: 'absolute', backgroundColor: colors.scrim },
  frame: { position: 'absolute', borderWidth: 2, borderColor: colors.onPhoto },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: colors.onPhoto,
  },
});

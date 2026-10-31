import {
  Canvas,
  Group,
  Image,
  Picture,
  type SkImage,
  type SkPicture,
} from '@shopify/react-native-skia';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';

import { containRect, type Size } from '../features/photo/geometry';

interface PhotoCanvasProps {
  /** The rendered photo, or `null` while it renders. */
  readonly image: SkImage | null;
  /** Size of the photo the overlay is drawn in (the full-resolution output). */
  readonly photoSize: Size;
  /** Drawn over the photo in `photoSize` coordinates, e.g. decorations. */
  readonly overlay?: SkPicture | null;
  /** How strongly the overlay shows (1 by default), e.g. faint for painted areas. */
  readonly overlayOpacity?: number;
  /** Receives where the photo is shown, for mapping touches to photo coordinates. */
  readonly onPhotoRect?: (rect: LayoutRectangle) => void;
  readonly children?: ReactNode;
}

/** Shows a photo fitted to the available space with an optional overlay. */
export function PhotoCanvas({
  image,
  photoSize,
  overlay,
  overlayOpacity = 1,
  onPhotoRect,
  children,
}: PhotoCanvasProps) {
  const [area, setArea] = useState<Size>({ width: 0, height: 0 });
  const rect = containRect(photoSize, area.width > 0 ? area : { width: 1, height: 1 });
  const scale = rect.width / photoSize.width;
  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setArea({ width, height });
        const fitted = containRect(photoSize, { width, height });
        onPhotoRect?.(fitted);
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ translateX: rect.x }, { translateY: rect.y }, { scale }]}>
          {image !== null && (
            <Image
              image={image}
              x={0}
              y={0}
              width={photoSize.width}
              height={photoSize.height}
              fit="fill"
            />
          )}
          {overlay !== undefined && overlay !== null && (
            <Group opacity={overlayOpacity}>
              <Picture picture={overlay} />
            </Group>
          )}
        </Group>
      </Canvas>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

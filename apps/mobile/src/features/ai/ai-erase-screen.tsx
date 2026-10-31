import { UPLOAD_LONG_EDGE } from '@fant/api-types';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NO_DECO_ASSETS, recordDeco } from '../../engine/draw-deco';
import { encodeEraseMask } from '../../engine/erase-mask';
import { decodeImage, imageSize } from '../../engine/photo';
import { PhotoCanvas } from '../../engine/photo-canvas';
import type { SkImage } from '../../engine/skia';
import { strings } from '../../i18n';
import { tempDirectory } from '../../lib/temp-files';
import { Button } from '../../ui/button';
import { showError } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { ScreenHeader } from '../../ui/screen-header';
import { Slider } from '../../ui/slider';
import { Text } from '../../ui/text';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { extendStroke, startStroke } from '../deco/deco-ops';
import { fitLongEdge } from '../photo/geometry';
import type { DecoStroke } from '../photo/recipe';

/** Strokes kept at most; more is never needed to cover a few things. */
const MAX_STROKES = 40;
/** How the painted area is shown while painting. */
const BRUSH_COLOR = '#ff5fa2';

/** Decodes the photo to paint on; freed when the screen closes. */
function usePhoto(uri: string): SkImage | null {
  const [image, setImage] = useState<SkImage | null>(null);
  useEffect(() => {
    let decoded: SkImage | null = null;
    try {
      decoded = decodeImage(new File(uri).bytesSync());
    } catch (error) {
      reportError(error, 'ai.erase.decode');
    }
    void Promise.resolve().then(() => {
      setImage(decoded);
    });
    return () => decoded?.dispose();
  }, [uri]);
  return image;
}

/**
 * Paint over what to remove (AI-10); the AI fills the painted area in to match
 * its surroundings. The mask goes with the photo to the generation screen.
 */
export function AiEraseScreen({ sourceUri }: { readonly sourceUri: string }) {
  const image = usePhoto(sourceUri);
  const { bottom } = useSafeAreaInsets();
  const [strokes, setStrokes] = useState<DecoStroke[]>([]);
  const [stroke, setStroke] = useState<DecoStroke | null>(null);
  const [brush, setBrush] = useState(0.06);
  const [photoRect, setPhotoRect] = useState<LayoutRectangle | null>(null);
  const size = image === null ? null : imageSize(image);

  const shown = useMemo(
    () => (stroke === null ? strokes : [...strokes, stroke]),
    [strokes, stroke],
  );
  const overlay = useMemo(
    () => (size === null ? null : recordDeco(shown, size.width, size.height, NO_DECO_ASSETS, null)),
    [shown, size],
  );
  useEffect(() => () => overlay?.dispose(), [overlay]);

  const toPhoto = (x: number, y: number) =>
    photoRect === null
      ? null
      : { x: (x - photoRect.x) / photoRect.width, y: (y - photoRect.y) / photoRect.height };

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    minDistance: 0,
    onBegin: (event) => {
      const point = toPhoto(event.x, event.y);
      if (point !== null && strokes.length < MAX_STROKES)
        setStroke(startStroke('pen', BRUSH_COLOR, brush, point.x, point.y));
    },
    onUpdate: (event) => {
      const point = toPhoto(event.x, event.y);
      if (point !== null)
        setStroke((current) => (current === null ? null : extendStroke(current, point.x, point.y)));
    },
    onFinalize: () => {
      if (stroke !== null) setStrokes([...strokes, stroke]);
      setStroke(null);
    },
  });

  const erase = () => {
    if (size === null) return;
    try {
      // The mask matches the photo as it is uploaded.
      const mask = encodeEraseMask(strokes, fitLongEdge(size, UPLOAD_LONG_EDGE));
      const file = new File(tempDirectory('ai'), `mask-${String(Date.now())}.png`);
      file.writeSync(mask);
      router.push({
        pathname: '/ai/generate',
        params: { uri: sourceUri, styleId: 'erase', maskUri: file.uri },
      });
    } catch (error) {
      reportError(error, 'ai.erase.mask');
      showError();
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottom + spacing.md }]}>
      <ScreenHeader
        title={strings.ai.erase.title}
        actions={
          <IconButton
            icon="arrow-undo"
            label={strings.edit.undo}
            disabled={strokes.length === 0}
            onPress={() => {
              setStrokes(strokes.slice(0, -1));
            }}
          />
        }
      />
      {size !== null && (
        <PhotoCanvas image={image} photoSize={size} overlay={overlay} onPhotoRect={setPhotoRect}>
          <GestureDetector gesture={pan}>
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>
        </PhotoCanvas>
      )}
      <View style={styles.panel}>
        <Text style={styles.hint}>{strings.ai.erase.hint}</Text>
        <Slider
          label={strings.ai.erase.brush}
          value={brush}
          min={0.02}
          max={0.15}
          onChange={setBrush}
        />
        <Button label={strings.ai.erase.run} disabled={strokes.length === 0} onPress={erase} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  panel: {
    gap: spacing.md,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  hint: { color: colors.textMuted, fontSize: 14 },
});

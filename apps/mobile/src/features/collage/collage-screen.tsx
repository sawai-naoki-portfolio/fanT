import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { recordCollage, renderCollage } from '../../engine/collage';
import { encodeJpeg, imageSize } from '../../engine/photo';
import { PhotoCanvas } from '../../engine/photo-canvas';
import { decodeScaled } from '../../engine/scaled-image';
import type { SkImage, SkPicture } from '../../engine/skia';
import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { ColorPalette } from '../../ui/color-palette';
import { showError } from '../../ui/dialogs';
import { ScreenHeader } from '../../ui/screen-header';
import { Slider } from '../../ui/slider';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { reportError, track } from '../analytics/analytics';
import { addPhoto } from '../album/album-db';
import { useAlbum } from '../album/use-album';
import { DECO_COLORS } from '../deco/deco-ops';
import type { Size } from '../photo/geometry';
import { newPhotoId } from '../photo/photo-service';
import { ASPECT_RATIOS, type AspectRatio } from '../photo/recipe';
import { useSettings } from '../settings/settings-store';
import { COLLAGE_LAYOUTS, type CollageLayout } from './collage-layout';

/** The saved collage's size per aspect ratio (long edge 2400 px). */
const OUTPUT_SIZES: Record<AspectRatio, Size> = {
  '3:4': { width: 1800, height: 2400 },
  '9:16': { width: 1350, height: 2400 },
  '1:1': { width: 2000, height: 2000 },
};
/** The preview is drawn at a third of the output size. */
const PREVIEW_SCALE = 1 / 3;
/** Photos are decoded this large for the preview. */
const PREVIEW_PHOTO_EDGE = 640;
const BACKGROUNDS = ['#ffffff', ...DECO_COLORS.filter((color) => color !== '#ffffff')];

/** Decodes small copies of the photos for the preview; freed when they change. */
function usePreviewPhotos(uris: readonly string[]): SkImage[] | null {
  const key = uris.join('|');
  const [photos, setPhotos] = useState<{ key: string; images: SkImage[] } | null>(null);
  useEffect(() => {
    let decoded: SkImage[] = [];
    const run = { cancelled: false };
    void (async () => {
      try {
        for (const uri of key.split('|')) decoded.push(await decodeScaled(uri, PREVIEW_PHOTO_EDGE));
        if (!run.cancelled) setPhotos({ key, images: decoded });
      } catch (error) {
        reportError(error, 'collage.decode');
        for (const image of decoded) image.dispose();
        decoded = [];
      }
    })();
    return () => {
      run.cancelled = true;
      for (const image of decoded) image.dispose();
    };
  }, [key]);
  return photos?.key === key ? photos.images : null;
}

/** Puts 2–6 album photos together into one (DCO-07). */
export function CollageScreen({ ids }: { readonly ids: readonly string[] }) {
  const album = useAlbum();
  const uris = useMemo(
    () =>
      ids.flatMap((id) => {
        const photo = album.find((candidate) => candidate.id === id);
        return photo === undefined ? [] : [photo.outputUri];
      }),
    [album, ids],
  );
  const photos = usePreviewPhotos(uris);
  const { bottom } = useSafeAreaInsets();
  const [layout, setLayout] = useState<CollageLayout>('grid');
  const [aspect, setAspect] = useState<AspectRatio>('3:4');
  const [gap, setGap] = useState(0.02);
  const [background, setBackground] = useState('#ffffff');
  const [saving, setSaving] = useState(false);

  const output = OUTPUT_SIZES[aspect];
  const preview = {
    width: Math.round(output.width * PREVIEW_SCALE),
    height: Math.round(output.height * PREVIEW_SCALE),
  };
  const options = { layout, gap, background };
  const picture = useMemo<SkPicture | null>(() => {
    if (photos === null || photos.length < 2) return null;
    return recordCollage(
      photos,
      { width: preview.width, height: preview.height },
      { layout, gap, background },
    );
  }, [photos, preview.width, preview.height, layout, gap, background]);
  useEffect(() => () => picture?.dispose(), [picture]);

  const save = async () => {
    setSaving(true);
    try {
      const image = await renderCollage(uris, output, options);
      try {
        const photo = addPhoto({
          id: newPhotoId(),
          kind: 'collage',
          output: encodeJpeg(image),
          ...imageSize(image),
          hasOriginal: false,
          recipe: null,
          originalRetentionDays: useSettings.getState().originalRetentionDays,
        });
        track({ name: 'collage_made', count: uris.length });
        router.replace({ pathname: '/photo/[id]', params: { id: photo.id } });
      } finally {
        image.dispose();
      }
    } catch (error) {
      reportError(error, 'collage.save');
      showError();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={strings.collage.title} />
      <PhotoCanvas image={null} photoSize={preview} overlay={picture} />
      <View style={[styles.panel, { paddingBottom: bottom + spacing.md }]}>
        <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
          <View style={styles.row}>
            {COLLAGE_LAYOUTS.map((candidate) => (
              <Chip
                key={candidate}
                label={strings.collage.layouts[candidate]}
                selected={layout === candidate}
                onPress={() => {
                  setLayout(candidate);
                }}
              />
            ))}
          </View>
          <View style={styles.row}>
            {ASPECT_RATIOS.map((candidate) => (
              <Chip
                key={candidate}
                label={candidate}
                selected={aspect === candidate}
                onPress={() => {
                  setAspect(candidate);
                }}
              />
            ))}
          </View>
          <Slider label={strings.collage.gap} value={gap} min={0} max={0.06} onChange={setGap} />
          <ColorPalette color={background} onChange={setBackground} colors={BACKGROUNDS} />
        </ScrollView>
        <Button
          label={strings.common.save}
          busy={saving}
          disabled={uris.length < 2}
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  panel: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  controls: { maxHeight: 240 },
  controlsContent: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

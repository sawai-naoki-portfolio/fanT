import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mergeExposures, mergePanorama } from '../../engine/merge';
import { encodeJpeg, imageSize } from '../../engine/photo';
import { PhotoCanvas } from '../../engine/photo-canvas';
import type { SkImage } from '../../engine/skia';
import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { showError } from '../../ui/dialogs';
import { ScreenHeader } from '../../ui/screen-header';
import { Text } from '../../ui/text';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { addPhoto } from '../album/album-db';
import { useAlbum } from '../album/use-album';
import { newPhotoId } from '../photo/photo-service';
import { useSettings } from '../settings/settings-store';
import { MERGE_MODES, type MergeMode } from './merge-modes';

const MERGE = { hdr: mergeExposures, panorama: mergePanorama } as const;

/** A small merge to look at before saving; freed when the screen closes. */
function usePreview(mode: MergeMode, uris: readonly string[]) {
  const key = uris.join('|');
  const [state, setState] = useState<{ image: SkImage | null; failed: boolean }>({
    image: null,
    failed: false,
  });
  useEffect(() => {
    let made: SkImage | null = null;
    let cancelled = false;
    void MERGE[mode](key.split('|'), MERGE_MODES[mode].previewEdge)
      .then((image) => {
        made = image;
        if (cancelled) image.dispose();
        else setState({ image, failed: false });
      })
      .catch((error: unknown) => {
        reportError(error, `merge.${mode}.preview`);
        if (!cancelled) setState({ image: null, failed: true });
      });
    return () => {
      cancelled = true;
      made?.dispose();
    };
  }, [mode, key]);
  return state;
}

/** Merges album photos into one (EDT-26, EDT-27) and saves it to the album. */
export function MergeScreen({
  mode,
  ids,
}: {
  readonly mode: MergeMode;
  readonly ids: readonly string[];
}) {
  const album = useAlbum();
  const uris = useMemo(
    () =>
      ids.flatMap((id) => {
        const photo = album.find((candidate) => candidate.id === id);
        // The unedited original merges best; the output stands in once it has gone.
        return photo === undefined ? [] : [photo.originalUri ?? photo.outputUri];
      }),
    [album, ids],
  );
  const preview = usePreview(mode, uris);
  const { bottom } = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const merged = await MERGE[mode](uris, MERGE_MODES[mode].outputEdge);
      try {
        const photo = addPhoto({
          id: newPhotoId(),
          kind: MERGE_MODES[mode].kind,
          output: encodeJpeg(merged),
          width: merged.width(),
          height: merged.height(),
          hasOriginal: false,
          recipe: null,
          originalRetentionDays: useSettings.getState().originalRetentionDays,
        });
        router.replace({ pathname: '/photo/[id]', params: { id: photo.id } });
      } finally {
        merged.dispose();
      }
    } catch (error) {
      reportError(error, `merge.${mode}.save`);
      showError();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottom + spacing.md }]}>
      <ScreenHeader title={strings.merge[mode].title} />
      {preview.image !== null ? (
        <PhotoCanvas image={preview.image} photoSize={imageSize(preview.image)} />
      ) : preview.failed ? (
        <Text style={styles.message}>{strings.merge.failed}</Text>
      ) : (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      )}
      <View style={styles.panel}>
        <Text style={styles.hint}>{strings.merge[mode].hint}</Text>
        <Button
          label={strings.common.save}
          busy={saving}
          disabled={preview.image === null}
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1 },
  message: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.text,
    padding: spacing.lg,
  },
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

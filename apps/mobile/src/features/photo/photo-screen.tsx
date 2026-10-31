import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { confirmDestructive } from '../../ui/dialogs';
import { haptics } from '../../ui/haptics';
import { IconButton } from '../../ui/icon-button';
import { Notice, useNotice } from '../../ui/notice';
import { ScreenHeader } from '../../ui/screen-header';
import { colors, radius, spacing } from '../../ui/theme';
import { deletePhotos } from '../album/album-db';
import { useAlbumPhoto } from '../album/use-album';
import { useAiAvailable } from '../remote-config/remote-config';
import { LoopingVideo } from '../video/looping-video';
import { savePhoto, sharePhotoFile, shareToStoriesFile, storiesAvailable } from './photo-actions';
import { Text } from '../../ui/text';

interface PhotoScreenProps {
  readonly id: string;
  /** Opened right after shooting (S-20) rather than from the album (S-51). */
  readonly fromCamera: boolean;
}

/** One photo with what can be done to it: save, share, edit, deco, AI, delete (S-20/S-51). */
export function PhotoScreen({ id, fromCamera }: PhotoScreenProps) {
  const photo = useAlbumPhoto(id);
  const aiAvailable = useAiAvailable();
  const { bottom } = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [notice, showNotice] = useNotice();

  if (photo === null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={strings.photo.title} />
      </View>
    );
  }

  const remove = async () => {
    if (!fromCamera && !(await confirmDestructive(strings.photo.deleteConfirm))) return;
    deletePhotos([photo.id]);
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={fromCamera ? '' : new Date(photo.createdAt).toLocaleDateString(strings.date.locale)}
        actions={
          <PhotoAction
            icon="trash-outline"
            label={fromCamera ? strings.photo.retake : strings.common.delete}
            onPress={() => {
              void remove();
            }}
          />
        }
      />
      <View style={styles.imageArea}>
        {photo.videoUri === null ? (
          <Image
            source={{ uri: photo.outputUri, cacheKey: `${photo.id}-${String(photo.updatedAt)}` }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            accessibilityLabel={strings.photo.title}
          />
        ) : (
          <LoopingVideo uri={photo.videoUri} style={StyleSheet.absoluteFill} />
        )}
        {photo.kind === 'ai' && <Text style={styles.aiLabel}>{strings.ai.aiLabel}</Text>}
      </View>
      <View style={[styles.actions, { paddingBottom: bottom + spacing.md }]}>
        <View style={styles.row}>
          <PhotoAction
            icon="color-palette"
            label={strings.photo.edit}
            disabled={photo.kind !== 'camera' && photo.kind !== 'import'}
            onPress={() => {
              router.push({ pathname: '/edit/[id]', params: { id: photo.id } });
            }}
          />
          <PhotoAction
            icon="brush"
            label={strings.photo.deco}
            disabled={photo.recipe === null}
            onPress={() => {
              router.push({ pathname: '/deco/[id]', params: { id: photo.id } });
            }}
          />
          {photo.videoUri === null && (
            <PhotoAction
              icon="water"
              label={strings.photo.motion}
              onPress={() => {
                router.push({ pathname: '/motion/[id]', params: { id: photo.id } });
              }}
            />
          )}
          {aiAvailable && photo.videoUri === null && (
            <PhotoAction
              icon="sparkles"
              label={strings.photo.ai}
              onPress={() => {
                router.push({ pathname: '/ai/styles', params: { photoId: photo.id } });
              }}
            />
          )}
          {storiesAvailable && photo.videoUri === null && (
            <PhotoAction
              icon="logo-instagram"
              label={strings.photo.stories}
              onPress={() => {
                void shareToStoriesFile(photo);
              }}
            />
          )}
          <PhotoAction
            icon="share-social"
            label={strings.common.share}
            onPress={() => {
              void sharePhotoFile(photo);
            }}
          />
        </View>
        <Button
          label={strings.common.save}
          busy={saving}
          onPress={() => {
            setSaving(true);
            void savePhoto(photo)
              .then((saved) => {
                if (!saved) return;
                haptics.success();
                showNotice(strings.photo.saved);
              })
              .finally(() => {
                setSaving(false);
              });
          }}
        />
      </View>
      <Notice notice={notice} />
    </View>
  );
}

/** A round action with its name underneath (the button itself carries the label). */
function PhotoAction(props: ComponentProps<typeof IconButton>) {
  return (
    <View style={styles.action}>
      <IconButton {...props} size={26} style={styles.actionButton} />
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[styles.actionLabel, props.disabled === true && styles.disabledLabel]}
      >
        {props.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // The photo as a framed print.
  imageArea: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 6,
    borderColor: colors.surface,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  aiLabel: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.onPhoto,
    fontSize: 11,
    backgroundColor: colors.scrim,
  },
  actions: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { alignItems: 'center', gap: spacing.xs },
  actionButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentSoft },
  actionLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  disabledLabel: { opacity: 0.35 },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { strings } from '../../i18n';
import { Bouncy } from '../../ui/bouncy';
import { confirmDestructive, showError, showMessage } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { ScreenHeader } from '../../ui/screen-header';
import { HeroEmoji } from '../../ui/hero-emoji';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { importPhoto, importRaw, RawNotSupportedError } from '../photo/import-photo';
import { MAX_COLLAGE_PHOTOS, MIN_COLLAGE_PHOTOS } from '../collage/collage-layout';
import { useLookClipboard } from '../looks/look-clipboard';
import { pasteLook } from '../looks/paste-look';
import { canMerge, type MergeMode } from '../merge/merge-modes';
import { rawDevelopSupported } from '../../../modules/raw-develop/src';
import { deletePhotos } from './album-db';
import { useAlbum } from './use-album';
import { Text } from '../../ui/text';

const COLUMNS = 3;

/** Photos taken with the app (ALB-01), with selection for deleting several (ALB-02). */
export function AlbumScreen() {
  const photos = useAlbum();
  const { width } = useWindowDimensions();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [pasting, setPasting] = useState(false);
  const copied = useLookClipboard((state) => state.look);
  const size = (width - spacing.sm * (COLUMNS + 1)) / COLUMNS;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeSelected = async () => {
    if (!(await confirmDestructive(strings.album.deleteConfirm(selected.size)))) return;
    deletePhotos([...selected]);
    setSelected(new Set());
    setSelecting(false);
  };

  /** Puts the copied edits on every selected photo (EDT-06, EDT-33). */
  const pasteSelected = async () => {
    if (copied === null) return;
    setPasting(true);
    try {
      const chosen = photos.filter((photo) => selected.has(photo.id));
      const changed = await pasteLook(chosen, copied, (error) => {
        reportError(error, 'album.paste');
      });
      showMessage(strings.album.pasted(changed, chosen.length));
      setSelected(new Set());
      setSelecting(false);
    } finally {
      setPasting(false);
    }
  };

  const runImport = async (source: typeof importPhoto) => {
    setImporting(true);
    try {
      const photo = await source();
      if (photo !== null) router.push({ pathname: '/edit/[id]', params: { id: photo.id } });
    } catch (error) {
      if (error instanceof RawNotSupportedError) {
        showMessage(strings.album.rawFailed);
        return;
      }
      reportError(error, 'album.import');
      showError();
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={selecting ? strings.album.selected(selected.size) : strings.album.title}
        actions={
          selecting ? (
            <>
              <IconButton
                icon="grid-outline"
                label={strings.collage.make}
                disabled={selected.size < MIN_COLLAGE_PHOTOS || selected.size > MAX_COLLAGE_PHOTOS}
                onPress={() => {
                  router.push({ pathname: '/collage', params: { ids: [...selected].join(',') } });
                  setSelecting(false);
                  setSelected(new Set());
                }}
              />
              {(['hdr', 'panorama'] as const satisfies readonly MergeMode[]).map((mode) => (
                <IconButton
                  key={mode}
                  icon={mode === 'hdr' ? 'contrast-outline' : 'resize-outline'}
                  label={strings.merge[mode].title}
                  disabled={!canMerge(mode, selected.size)}
                  onPress={() => {
                    router.push({
                      pathname: '/merge',
                      params: { mode, ids: [...selected].join(',') },
                    });
                    setSelecting(false);
                    setSelected(new Set());
                  }}
                />
              ))}
              <IconButton
                icon="clipboard-outline"
                label={strings.edit.pasteLook}
                disabled={copied === null || selected.size === 0 || pasting}
                onPress={() => void pasteSelected()}
              />
              <IconButton
                icon="trash-outline"
                label={strings.common.delete}
                disabled={selected.size === 0}
                onPress={() => void removeSelected()}
              />
              <IconButton
                icon="close"
                label={strings.common.cancel}
                onPress={() => {
                  setSelecting(false);
                  setSelected(new Set());
                }}
              />
            </>
          ) : (
            <>
              <IconButton
                icon="add"
                label={strings.album.import}
                disabled={importing}
                onPress={() => void runImport(importPhoto)}
              />
              <IconButton
                icon="aperture-outline"
                label={strings.album.importRaw}
                disabled={importing || !rawDevelopSupported}
                onPress={() => void runImport(importRaw)}
              />
              <IconButton
                icon="checkmark-circle-outline"
                label={strings.album.select}
                disabled={photos.length === 0}
                onPress={() => {
                  setSelecting(true);
                }}
              />
            </>
          )
        }
      />
      <FlatList
        data={photos}
        numColumns={COLUMNS}
        keyExtractor={(photo) => photo.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={
          <View style={styles.empty}>
            <HeroEmoji emoji="📷" tint={colors.lavenderSoft} />
            <Text style={styles.emptyText}>{strings.album.empty}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Bouncy
              accessibilityRole={selecting ? 'checkbox' : 'imagebutton'}
              accessibilityState={selecting ? { checked: isSelected } : undefined}
              accessibilityLabel={new Date(item.createdAt).toLocaleString(strings.date.locale)}
              onPress={() => {
                if (selecting) toggle(item.id);
                else router.push({ pathname: '/photo/[id]', params: { id: item.id } });
              }}
              onLongPress={() => {
                setSelecting(true);
                toggle(item.id);
              }}
            >
              <Image
                source={{ uri: item.outputUri, cacheKey: `${item.id}-${String(item.updatedAt)}` }}
                style={[
                  styles.tile,
                  { width: size, height: size },
                  isSelected && styles.selectedTile,
                ]}
                contentFit="cover"
                recyclingKey={item.id}
              />
              {item.videoUri !== null && (
                <View style={styles.videoBadge} pointerEvents="none">
                  <Ionicons name="play" size={14} color={colors.onPhoto} />
                </View>
              )}
              {selecting && (
                <View style={[styles.check, isSelected && styles.checked]}>
                  {isSelected && <Ionicons name="heart" size={14} color={colors.accentText} />}
                </View>
              )}
            </Bouncy>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  grid: { gap: spacing.sm, padding: spacing.sm },
  gridRow: { gap: spacing.sm },
  tile: { borderRadius: radius.md, borderWidth: 3, borderColor: colors.surface },
  selectedTile: { borderColor: colors.accent },
  videoBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.scrim,
  },
  empty: { alignItems: 'center', gap: spacing.lg, marginTop: spacing.xl * 2 },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  check: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.overlay,
    ...softShadow,
  },
  checked: { backgroundColor: colors.accent },
});

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type LayoutRectangle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NO_DECO_ASSETS, recordDeco } from '../../engine/draw-deco';
import { motionPreviewFrames, writeMotionFrames } from '../../engine/motion-frames';
import { imageSize } from '../../engine/photo';
import { PhotoCanvas } from '../../engine/photo-canvas';
import { decodeScaled } from '../../engine/scaled-image';
import type { SkImage } from '../../engine/skia';
import { strings } from '../../i18n';
import { tempDirectory } from '../../lib/temp-files';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { showError } from '../../ui/dialogs';
import { ScreenHeader } from '../../ui/screen-header';
import { Slider } from '../../ui/slider';
import { Text } from '../../ui/text';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { useAlbumPhoto } from '../album/use-album';
import { BrushLayer } from '../edit/brush-layer';
import { MAX_BRUSH_STROKES, type DecoStroke } from '../photo/recipe';
import { saveFramesVideo } from '../video/video-service';
import {
  flowOf,
  MOTION_DIRECTIONS,
  MOTION_FPS,
  MOTION_FRAME_COUNT,
  MOTION_LOOP_SECONDS,
  type MotionDirection,
} from './motion-settings';

/** Long edge of the photo while painting and previewing, and of the saved video. */
const PREVIEW_EDGE = 640;
const VIDEO_EDGE = 1080;
/** Frames the preview cycles through; the saved video has every frame. */
const PREVIEW_FRAMES = 12;

/** A small copy of the album photo to paint on; freed when the screen closes. */
function useStill(uri: string | null): SkImage | null {
  const [still, setStill] = useState<SkImage | null>(null);
  useEffect(() => {
    if (uri === null) return;
    let decoded: SkImage | null = null;
    let cancelled = false;
    void decodeScaled(uri, PREVIEW_EDGE)
      .then((image) => {
        decoded = image;
        if (cancelled) image.dispose();
        else setStill(image);
      })
      .catch((error: unknown) => {
        reportError(error, 'motion.decode');
      });
    return () => {
      cancelled = true;
      decoded?.dispose();
    };
  }, [uri]);
  return still;
}

/** The preview loop: a few frames shown in turn, freed when anything changes. */
function useLoop(frames: readonly SkImage[]): SkImage | null {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (frames.length === 0) return;
    const timer = setInterval(
      () => {
        setIndex((current) => (current + 1) % frames.length);
      },
      (MOTION_LOOP_SECONDS * 1000) / frames.length,
    );
    return () => {
      clearInterval(timer);
    };
  }, [frames]);
  useEffect(
    () => () => {
      for (const frame of frames) frame.dispose();
    },
    [frames],
  );
  return frames[index % Math.max(1, frames.length)] ?? null;
}

/**
 * Makes a moving photo on the device (EDT-37): paint the part that should move
 * (water, clouds), choose a direction and speed, and save a looping video.
 */
export function MotionScreen({ id }: { readonly id: string }) {
  const photo = useAlbumPhoto(id);
  const still = useStill(photo?.outputUri ?? null);
  const { bottom } = useSafeAreaInsets();
  const [strokes, setStrokes] = useState<DecoStroke[]>([]);
  const [direction, setDirection] = useState<MotionDirection>('right');
  const [speed, setSpeed] = useState(0.5);
  const [brushSize, setBrushSize] = useState(0.06);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rect, setRect] = useState<LayoutRectangle | null>(null);

  const frames = useMemo(
    () =>
      playing && still !== null && strokes.length > 0
        ? motionPreviewFrames(
            { photo: still, strokes, flow: flowOf(direction, speed) },
            PREVIEW_FRAMES,
          )
        : [],
    [playing, still, strokes, direction, speed],
  );
  const frame = useLoop(frames);
  const size = useMemo(() => (still === null ? null : imageSize(still)), [still]);
  const overlay = useMemo(
    () =>
      playing || size === null
        ? null
        : recordDeco(strokes, size.width, size.height, NO_DECO_ASSETS, null),
    [playing, strokes, size],
  );
  useEffect(() => () => overlay?.dispose(), [overlay]);

  const save = async () => {
    if (photo === null) return;
    setSaving(true);
    const folder = tempDirectory(`motion-${String(Date.now())}`);
    let source: SkImage | null = null;
    try {
      source = await decodeScaled(photo.outputUri, VIDEO_EDGE);
      const uris = writeMotionFrames(
        { photo: source, strokes, flow: flowOf(direction, speed) },
        MOTION_FRAME_COUNT,
        folder,
      );
      const video = await saveFramesVideo(uris, MOTION_FPS);
      router.replace({ pathname: '/photo/[id]', params: { id: video.id } });
    } catch (error) {
      reportError(error, 'motion.save');
      showError();
    } finally {
      source?.dispose();
      if (folder.exists) folder.delete();
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottom + spacing.md }]}>
      <ScreenHeader title={strings.motion.title} />
      {size === null ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : (
        <PhotoCanvas
          image={playing ? frame : still}
          photoSize={size}
          overlay={overlay}
          overlayOpacity={0.4}
          onPhotoRect={setRect}
        >
          {!playing && (
            <BrushLayer
              rect={rect}
              width={brushSize}
              onStroke={(stroke) => {
                if (strokes.length < MAX_BRUSH_STROKES) setStrokes([...strokes, stroke]);
              }}
            />
          )}
        </PhotoCanvas>
      )}
      <View style={styles.panel}>
        <Text style={styles.hint}>{strings.motion.hint}</Text>
        <View style={styles.row}>
          {(Object.keys(MOTION_DIRECTIONS) as MotionDirection[]).map((candidate) => (
            <Chip
              key={candidate}
              label={strings.motion.directions[candidate]}
              selected={direction === candidate}
              onPress={() => {
                setDirection(candidate);
              }}
            />
          ))}
        </View>
        <Slider label={strings.motion.speed} value={speed} min={0.1} max={1} onChange={setSpeed} />
        {!playing && (
          <Slider
            label={strings.motion.brush}
            value={brushSize}
            min={0.02}
            max={0.15}
            onChange={setBrushSize}
          />
        )}
        <View style={styles.row}>
          <Button
            label={playing ? strings.motion.paint : strings.motion.play}
            variant="secondary"
            disabled={strokes.length === 0}
            onPress={() => {
              setPlaying(!playing);
            }}
          />
          <Button
            label={strings.motion.undo}
            variant="secondary"
            disabled={strokes.length === 0 || playing}
            onPress={() => {
              setStrokes(strokes.slice(0, -1));
            }}
          />
        </View>
        <Button
          label={strings.common.save}
          busy={saving}
          disabled={strokes.length === 0 || photo === null}
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1 },
  panel: {
    gap: spacing.md,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 14 },
});

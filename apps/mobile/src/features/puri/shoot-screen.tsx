import type { Layout } from '@fant/content-schema';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraView, type CameraViewHandle, type Lens } from '../../engine/camera-view';
import { useFaceTracking } from '../../engine/face-tracking';
import { localized, strings } from '../../i18n';
import { sleep } from '../../lib/sleep';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { showError } from '../../ui/dialogs';
import { haptics } from '../../ui/haptics';
import { IconButton } from '../../ui/icon-button';
import { colors, radius, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { CameraPermissionGate } from '../camera/camera-permission-gate';
import { Countdown, ScreenFlash } from '../camera/preview-overlays';
import { useCameraActive } from '../camera/use-camera-active';
import { useLook, type LookSpec } from '../camera/use-camera-look';
import { usePreviewRenderer } from '../camera/use-preview-renderer';
import { useContent } from '../content/content-store';
import { containRect } from '../photo/geometry';
import { personSegmentationSupported } from '../../../modules/person-segmentation/src';
import { BACKDROPS } from '../photo/backdrops';
import { PURI_BEAUTY, PURI_FILM_ID, renderPuriShot } from './puri-look';
import { usePuriSession } from './puri-session';
import { Text } from '../../ui/text';

const INTERVALS = [3, 5, 10] as const;
const SPEC: LookSpec = {
  filmId: PURI_FILM_ID,
  intensity: 1,
  beauty: PURI_BEAUTY,
  dateStamp: null,
  character: null,
};

/** Width ÷ height of a layout's cell on the sheet. */
function cellAspect(layout: Layout, index: number): number {
  const cell = layout.cells[index];
  return cell === undefined ? 3 / 4 : (cell.width * layout.width) / (cell.height * layout.height);
}

/**
 * Continuous shooting with a countdown and a pose prompt per shot (S-31, PRI-02),
 * with the purikura look (PRI-03). The back camera and longer intervals make it easy
 * to shoot a group from one phone (PRI-07). `retake` reshoots a single cell.
 */
export function ShootScreen({ retake }: { readonly retake: number | null }) {
  return (
    <CameraPermissionGate>
      <PuriCamera retake={retake} />
    </CameraPermissionGate>
  );
}

function PuriCamera({ retake }: { readonly retake: number | null }) {
  const layoutId = usePuriSession((state) => state.layoutId);
  const backdrop = usePuriSession((state) => state.backdrop);
  const layout = useContent((state) => state.manifest.layouts.find(({ id }) => id === layoutId));
  const isActive = useCameraActive();
  const { top, bottom } = useSafeAreaInsets();
  const [lens, setLens] = useState<Lens>('front');
  const [interval, setShotInterval] = useState<(typeof INTERVALS)[number]>(3);
  const [current, setCurrent] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [seed] = useState(Math.random);
  const camera = useRef<CameraViewHandle>(null);
  const zoom = useSharedValue(1);
  const look = useLook(SPEC, seed);
  const tracking = useFaceTracking({ onEyes: null, trackFaces: false });
  const { onFrame } = usePreviewRenderer({ look, seed, tracking, showCharacter: false });

  if (layout === undefined) return null;
  const retakeIndex = retake !== null && retake < layout.cells.length ? retake : null;
  const indices = retakeIndex === null ? layout.cells.map((_, index) => index) : [retakeIndex];
  const shotIndex = current ?? indices[0] ?? 0;
  const pose = layout.poses[shotIndex % layout.poses.length];
  const box = containRect(
    { width: cellAspect(layout, shotIndex), height: 1 },
    area.width > 0 ? area : { width: 1, height: 1 },
  );

  const run = async () => {
    const pending: Promise<void>[] = [];
    try {
      for (const index of indices) {
        setCurrent(index);
        for (let remaining = interval; remaining > 0; remaining--) {
          setCountdown(remaining);
          haptics.select();
          await sleep(1000);
        }
        setCountdown(null);
        if (lens === 'front') {
          setFlash(true);
          await sleep(250);
        }
        const handle = camera.current;
        if (handle === null) throw new Error('Camera is not ready');
        const captured = await handle.capture({ flash: 'off' }).finally(() => {
          setFlash(false);
        });
        haptics.press();
        // Rendering overlaps the next countdown.
        pending.push(
          renderPuriShot({
            bytes: captured.bytes,
            cellAspect: cellAspect(layout, index),
            mirror: (lens === 'front') !== captured.isMirrored,
            // A different grain per shot, derived from this session's seed.
            seed: (seed + index * 0.618034) % 1,
            backdrop: usePuriSession.getState().backdrop,
          }).then((jpeg) => {
            usePuriSession.getState().setShot(index, jpeg);
          }),
        );
      }
      await Promise.all(pending);
      if (retakeIndex === null) router.replace('/puri/finish');
      else router.back();
    } catch (error) {
      reportError(error, 'puri.shoot');
      showError(strings.camera.captureFailed);
      setCurrent(null);
      setCountdown(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: top + spacing.sm }]}>
        <IconButton
          icon="close"
          label={strings.common.close}
          onPress={() => {
            router.back();
          }}
        />
        <Text style={styles.progress}>
          {strings.puri.shotOf(indices.indexOf(shotIndex) + 1, indices.length)}
        </Text>
        <IconButton
          icon="camera-reverse-outline"
          label={strings.camera.switchLens}
          disabled={current !== null}
          onPress={() => {
            setLens((value) => (value === 'front' ? 'back' : 'front'));
          }}
        />
      </View>
      <View
        style={styles.previewArea}
        onLayout={(event) => {
          setArea(event.nativeEvent.layout);
        }}
      >
        <View
          style={[
            styles.previewBox,
            { left: box.x, top: box.y, width: box.width, height: box.height },
          ]}
        >
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            lens={lens}
            isActive={isActive}
            zoom={zoom}
            exposure={0}
            onFrame={onFrame}
          />
          {countdown !== null && <Countdown seconds={countdown} />}
        </View>
        {pose !== undefined && <Text style={styles.pose}>{localized(pose)}</Text>}
      </View>
      <View style={[styles.controls, { paddingBottom: bottom + spacing.md }]}>
        {personSegmentationSupported && (
          <View style={styles.row}>
            <Chip
              label={strings.puri.backdropNone}
              selected={backdrop === null}
              onPress={() => {
                usePuriSession.getState().setBackdrop(null);
              }}
            />
            {BACKDROPS.map((candidate) => (
              <Chip
                key={candidate.id}
                label={candidate.emoji}
                selected={backdrop?.id === candidate.id}
                onPress={() => {
                  usePuriSession.getState().setBackdrop(candidate);
                }}
              />
            ))}
          </View>
        )}
        <View style={styles.row}>
          {INTERVALS.map((seconds) => (
            <Chip
              key={seconds}
              label={strings.camera.timer(seconds)}
              selected={interval === seconds}
              onPress={() => {
                setShotInterval(seconds);
              }}
            />
          ))}
        </View>
        <Button label={strings.puri.start} disabled={current !== null} onPress={() => void run()} />
      </View>
      {flash && <ScreenFlash />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  progress: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    backgroundColor: colors.accentSoft,
  },
  previewArea: { flex: 1, margin: spacing.md },
  previewBox: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.text,
  },
  pose: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.accentText,
    fontSize: 18,
    fontWeight: '800',
    backgroundColor: colors.accent,
  },
  controls: { gap: spacing.md, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
});

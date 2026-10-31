import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../../i18n';
import { IconButton, type IconName } from '../../ui/icon-button';
import { spacing } from '../../ui/theme';
import { ASPECT_RATIOS } from '../photo/recipe';
import { FLASH_MODES, TIMER_SECONDS, useCameraSettings, type FlashMode } from './camera-store';
import { nextItem } from './presets';

const FLASH_ICONS: Record<FlashMode, IconName> = {
  off: 'flash-off',
  on: 'flash',
  auto: 'flash-outline',
};

/** Flash (CAM-06), timer (CAM-07), aspect ratio (CAM-05), grid (CAM-10) and settings. */
export function TopBar() {
  const { top } = useSafeAreaInsets();
  const flash = useCameraSettings((state) => state.flash);
  const timer = useCameraSettings((state) => state.timer);
  const aspect = useCameraSettings((state) => state.aspect);
  const grid = useCameraSettings((state) => state.grid);
  const { update } = useCameraSettings.getState();

  return (
    <View style={[styles.bar, { paddingTop: top + spacing.sm }]}>
      <IconButton
        icon={FLASH_ICONS[flash]}
        label={strings.camera.flash[flash]}
        badge={flash === 'auto' ? 'A' : undefined}
        onPress={() => {
          update({ flash: nextItem(FLASH_MODES, flash) });
        }}
      />
      <IconButton
        icon="timer-outline"
        label={strings.camera.timer(timer)}
        badge={timer === 0 ? undefined : `${String(timer)}s`}
        active={timer !== 0}
        onPress={() => {
          update({ timer: nextItem(TIMER_SECONDS, timer) });
        }}
      />
      <IconButton
        icon="crop-outline"
        label={strings.camera.aspect(aspect)}
        badge={aspect}
        onPress={() => {
          update({ aspect: nextItem(ASPECT_RATIOS, aspect) });
        }}
      />
      <IconButton
        icon="grid-outline"
        label={strings.camera.grid(grid)}
        active={grid}
        onPress={() => {
          update({ grid: !grid });
        }}
      />
      <IconButton
        icon="settings-outline"
        label={strings.camera.settings}
        onPress={() => {
          router.push('/settings');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});

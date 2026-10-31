import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { strings } from '../../i18n';
import { Bouncy } from '../../ui/bouncy';
import { Gradient } from '../../ui/gradient';
import { Text } from '../../ui/text';
import { colors, radius, spacing, TOUCH_TARGET } from '../../ui/theme';
import { track } from '../analytics/analytics';
import { useAiAvailable } from '../remote-config/remote-config';
import { CAMERA_MODES, useCameraSettings, type CameraMode } from './camera-store';

/**
 * Switches between the modes (CAM-12) as a row of candy pills, scrolling on narrow
 * screens. Film, video and character shoot here; puri and AI have their own flows.
 */
export function ModeTabs() {
  const mode = useCameraSettings((state) => state.mode);
  const aiAvailable = useAiAvailable();
  const select = (next: CameraMode) => {
    track({ name: 'mode_selected', mode: next });
    if (next === 'puri') router.push('/puri');
    else if (next === 'ai') router.push('/ai');
    else useCameraSettings.getState().update({ mode: next });
  };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View accessibilityRole="tablist" style={styles.tabs}>
        {CAMERA_MODES.filter((candidate) => candidate !== 'ai' || aiAvailable).map((candidate) => {
          const selected = candidate === mode;
          return (
            <Bouncy
              key={candidate}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={styles.tab}
              onPress={() => {
                select(candidate);
              }}
            >
              {selected && (
                <Animated.View entering={ZoomIn.springify()} style={StyleSheet.absoluteFill}>
                  <Gradient style={styles.pill} />
                </Animated.View>
              )}
              <Text style={[styles.label, selected && styles.selected]}>
                {strings.modes[candidate]}
              </Text>
            </Bouncy>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.md },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  tab: {
    minHeight: TOUCH_TARGET - spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  pill: { flex: 1, borderRadius: radius.pill },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  selected: { color: colors.accentText },
});

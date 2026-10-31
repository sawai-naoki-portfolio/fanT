import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';

import { Text } from '../../ui/text';
import { colors } from '../../ui/theme';

/** Rule-of-thirds grid (CAM-10). */
export function GridOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[1, 2].map((line) => (
        <View
          key={`v${String(line)}`}
          style={[styles.vertical, { left: `${String((line * 100) / 3)}%` }]}
        />
      ))}
      {[1, 2].map((line) => (
        <View
          key={`h${String(line)}`}
          style={[styles.horizontal, { top: `${String((line * 100) / 3)}%` }]}
        />
      ))}
    </View>
  );
}

/** Where the camera focused (CAM-08): a pink ring that pops in. */
export function FocusRing({
  point,
}: {
  readonly point: { readonly x: number; readonly y: number };
}) {
  return (
    <Animated.View
      key={`${String(point.x)}-${String(point.y)}`}
      entering={ZoomIn.springify()}
      pointerEvents="none"
      style={[styles.focus, { left: point.x - FOCUS / 2, top: point.y - FOCUS / 2 }]}
    />
  );
}

/** Seconds left on the self-timer (CAM-07); each number bounces in. */
export function Countdown({ seconds }: { readonly seconds: number }) {
  return (
    <View pointerEvents="none" style={styles.countdown}>
      <Animated.View key={seconds} entering={ZoomIn.springify()} exiting={FadeOut}>
        <Text accessibilityLiveRegion="assertive" style={styles.countdownText}>
          {seconds}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Lights the face with the screen when the front camera "flashes" (CAM-06). */
export function ScreenFlash() {
  return <View pointerEvents="none" style={styles.flash} />;
}

const FOCUS = 72;
const GRID_LINE = 'rgba(255, 255, 255, 0.6)';

const styles = StyleSheet.create({
  vertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: GRID_LINE,
  },
  horizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GRID_LINE,
  },
  focus: {
    position: 'absolute',
    width: FOCUS,
    height: FOCUS,
    borderRadius: FOCUS / 2,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  countdown: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  countdownText: {
    color: colors.onPhoto,
    fontSize: 112,
    fontWeight: '800',
    textShadowColor: colors.accent,
    textShadowRadius: 16,
  },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: '#fff' },
});

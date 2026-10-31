import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from './text';
import { colors } from './theme';

const SIZE = 132;

/**
 * A big emoji in a soft bubble that gently floats, for empty states and
 * welcome pages. Decorative only: hidden from screen readers.
 */
export function HeroEmoji({
  emoji,
  tint = colors.accentSoft,
}: {
  readonly emoji: string;
  readonly tint?: string;
}) {
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.set(
      withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [lift]);
  const floating = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * lift.get() }, { rotate: `${String(-4 + 8 * lift.get())}deg` }],
  }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.bubble, { backgroundColor: tint }, floating]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: SIZE / 2,
  },
  emoji: { fontSize: 64, lineHeight: 80 },
});

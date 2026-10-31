import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface BouncyProps extends Omit<PressableProps, 'style' | 'children'> {
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
  /** How far it squashes while pressed. */
  readonly squash?: number;
  /** A haptic tap on press (default: a light selection tick). */
  readonly feedback?: 'select' | 'press' | 'none';
}

/**
 * A pressable that squashes and springs back like a jelly button, with a light
 * haptic tick. Every tappable thing in the app uses it, so the whole UI feels
 * the same.
 */
export function Bouncy({
  style,
  children,
  squash = 0.92,
  feedback = 'select',
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: BouncyProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...props}
      style={[style, animated]}
      onPressIn={(event) => {
        scale.set(withSpring(squash, { damping: 15, stiffness: 400 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, { damping: 8, stiffness: 300 }));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (feedback !== 'none') haptics[feedback]();
        onPress?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

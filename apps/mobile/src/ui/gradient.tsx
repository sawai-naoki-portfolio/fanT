import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { GRADIENT } from './theme';

/** A diagonal pastel gradient behind its children. */
export function Gradient({
  colors = GRADIENT,
  style,
  children,
}: {
  readonly colors?: readonly [string, string, ...string[]];
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
}) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}

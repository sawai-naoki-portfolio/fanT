import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Bouncy } from './bouncy';
import { Text } from './text';
import { colors, TOUCH_TARGET } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps {
  readonly icon: IconName;
  readonly label: string;
  readonly onPress: () => void;
  /** For press-and-hold buttons, such as comparing with the photo before editing. */
  readonly onPressIn?: () => void;
  readonly onPressOut?: () => void;
  /** A small tag on the corner, e.g. "3s". */
  readonly badge?: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly size?: number;
  /** `plain` drops the round background (e.g. inside headers). */
  readonly variant?: 'round' | 'plain';
  readonly style?: StyleProp<ViewStyle>;
}

/** A round, squishy icon button with a screen-reader label (03 §9). */
export function IconButton({
  icon,
  label,
  onPress,
  onPressIn,
  onPressOut,
  badge,
  active,
  disabled,
  size = 24,
  variant = 'round',
  style,
}: IconButtonProps) {
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      hitSlop={4}
      squash={0.85}
      style={[
        styles.button,
        variant === 'round' && styles.round,
        active === true && styles.active,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <View>
        <Ionicons
          name={icon}
          size={size}
          color={active === true ? colors.accentText : colors.accent}
        />
        {badge !== undefined && <Text style={styles.badge}>{badge}</Text>}
      </View>
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: TOUCH_TARGET / 2,
  },
  round: { backgroundColor: colors.overlay },
  active: { backgroundColor: colors.accent },
  disabled: { opacity: 0.35 },
  badge: {
    position: 'absolute',
    right: -12,
    bottom: -8,
    paddingHorizontal: 4,
    borderRadius: 6,
    overflow: 'hidden',
    color: colors.accentText,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: colors.lavender,
  },
});

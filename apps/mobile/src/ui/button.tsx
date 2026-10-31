import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Bouncy } from './bouncy';
import { Gradient } from './gradient';
import { Text } from './text';
import { colors, PREMIUM_GRADIENT, radius, softShadow, spacing, TOUCH_TARGET } from './theme';

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  /** `primary` is the pink-lavender candy button, `premium` the lemon-pink one. */
  readonly variant?: 'primary' | 'secondary' | 'premium' | 'danger';
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled === true || busy === true;
  const filled = variant === 'primary' || variant === 'premium';
  const content =
    busy === true ? (
      <ActivityIndicator color={filled ? colors.accentText : colors.accent} />
    ) : (
      <Text
        style={[
          styles.label,
          !filled && styles.secondaryLabel,
          variant === 'danger' && styles.dangerLabel,
        ]}
      >
        {label}
      </Text>
    );
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      feedback={filled ? 'press' : 'select'}
      style={[inactive && styles.dimmed, filled && softShadow, style]}
      onPress={onPress}
    >
      {filled ? (
        <Gradient
          colors={variant === 'premium' ? PREMIUM_GRADIENT : undefined}
          style={styles.button}
        >
          {content}
        </Gradient>
      ) : (
        <View style={[styles.button, styles.secondary]}>{content}</View>
      )}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_TARGET + 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  secondary: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accentSoft },
  dimmed: { opacity: 0.45 },
  label: { color: colors.accentText, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  secondaryLabel: { color: colors.accent },
  dangerLabel: { color: colors.danger },
});

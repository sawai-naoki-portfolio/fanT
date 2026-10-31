import { StyleSheet, View } from 'react-native';

import { Bouncy } from './bouncy';
import { Gradient } from './gradient';
import { Text } from './text';
import { colors, radius, spacing } from './theme';

interface ChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  /** Premium item the user does not have: shown with a crown. */
  readonly locked?: boolean;
  readonly badge?: string;
}

/** A selectable candy pill, e.g. a beauty level or a text style. */
export function Chip({ label, selected, onPress, locked, badge }: ChipProps) {
  const content = (
    <>
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {locked === true ? `👑 ${label}` : label}
      </Text>
      {badge !== undefined && <Text style={styles.badge}>{badge}</Text>}
    </>
  );
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      squash={0.9}
      onPress={onPress}
    >
      {selected ? (
        <Gradient style={styles.chip}>{content}</Gradient>
      ) : (
        <View style={[styles.chip, styles.idle]}>{content}</View>
      )}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  idle: { backgroundColor: colors.surfaceRaised },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  selectedLabel: { color: colors.accentText },
  badge: { color: colors.lavender, fontSize: 10, fontWeight: '800' },
});

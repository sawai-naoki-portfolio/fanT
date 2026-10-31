import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Bouncy } from '../../ui/bouncy';
import { Chip } from '../../ui/chip';
import { Toggle } from '../../ui/toggle';
import { colors, radius, softShadow, spacing, TOUCH_TARGET } from '../../ui/theme';
import { Text } from '../../ui/text';

export function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SwitchRow({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Toggle label={label} value={value} onChange={onChange} />
    </View>
  );
}

export function ChoiceRow<T>({
  label,
  options,
  value,
  format,
  onChange,
}: {
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly format: (option: T) => string;
  readonly onChange: (option: T) => void;
}) {
  return (
    <View style={styles.choice}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip
            key={format(option)}
            label={format(option)}
            selected={option === value}
            onPress={() => {
              onChange(option);
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function LinkRow({
  label,
  value,
  onPress,
}: {
  readonly label: string;
  readonly value?: string;
  readonly onPress: () => void;
}) {
  return (
    <Bouncy accessibilityRole="button" squash={0.97} style={styles.row} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, value === undefined && styles.chevron]}>{value ?? '›'}</Text>
    </Bouncy>
  );
}

export function InfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
  },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, ...softShadow },
  row: {
    minHeight: TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  choice: {
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  label: { flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  value: { color: colors.textMuted, fontSize: 14 },
  chevron: { color: colors.accent, fontSize: 22, fontWeight: '800' },
});

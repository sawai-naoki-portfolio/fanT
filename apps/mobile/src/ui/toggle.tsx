import { Switch } from 'react-native';

import { haptics } from './haptics';
import { colors } from './theme';

/** A pink on/off switch with a haptic tick. */
export function Toggle({
  label,
  value,
  onChange,
}: {
  /** Read by screen readers. */
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
      thumbColor={colors.surface}
      ios_backgroundColor={colors.surfaceRaised}
      onValueChange={(next) => {
        haptics.select();
        onChange(next);
      }}
    />
  );
}

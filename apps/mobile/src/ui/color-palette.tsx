import { StyleSheet, View } from 'react-native';

import { DECO_COLORS } from '../features/deco/deco-ops';
import { Bouncy } from './bouncy';
import { colors as theme, softShadow, spacing } from './theme';

/** Round colour swatches to pick one from (pens, text, frames, makeup). */
export function ColorPalette({
  color,
  onChange,
  colors = DECO_COLORS,
}: {
  readonly color: string;
  readonly onChange: (color: string) => void;
  readonly colors?: readonly string[];
}) {
  return (
    <View style={styles.row}>
      {colors.map((candidate) => (
        <Bouncy
          key={candidate}
          accessibilityRole="button"
          accessibilityLabel={candidate}
          accessibilityState={{ selected: candidate === color }}
          style={[
            styles.swatch,
            { backgroundColor: candidate },
            candidate === color && styles.selected,
          ]}
          onPress={() => {
            onChange(candidate);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: theme.surface,
    ...softShadow,
  },
  selected: { borderColor: theme.accent, borderWidth: 4 },
});

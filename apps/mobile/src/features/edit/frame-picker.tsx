import { StyleSheet, View } from 'react-native';

import { ColorPalette } from '../../ui/color-palette';
import { strings } from '../../i18n';
import { Chip } from '../../ui/chip';
import { Text } from '../../ui/text';
import { colors, spacing } from '../../ui/theme';
import { DECO_COLORS } from '../deco/deco-ops';
import { FRAME_TYPES, type Frame } from '../photo/frames';

/** The oshi colour a new oshi frame starts with. */
const DEFAULT_OSHI_COLOR = DECO_COLORS[1];

/** Chooses a frame (FLM-07) and, for the oshi frame, its colour (PRI-08). */
export function FramePicker({
  frame,
  onChange,
}: {
  readonly frame: Frame | null;
  readonly onChange: (frame: Frame | null) => void;
}) {
  const color = frame?.color ?? DEFAULT_OSHI_COLOR;
  return (
    <>
      <View style={styles.chips}>
        <Chip
          label={strings.frames.none}
          selected={frame === null}
          onPress={() => {
            onChange(null);
          }}
        />
        {FRAME_TYPES.map((type) => (
          <Chip
            key={type}
            label={strings.frames[type]}
            selected={frame?.type === type}
            onPress={() => {
              onChange({ type, color });
            }}
          />
        ))}
      </View>
      {frame?.type === 'oshi' && (
        <>
          <Text style={styles.label}>{strings.frames.oshiColor}</Text>
          <ColorPalette
            color={frame.color}
            onChange={(next) => {
              onChange({ ...frame, color: next });
            }}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
});

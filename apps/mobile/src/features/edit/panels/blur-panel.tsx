import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { Slider } from '../../../ui/slider';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import type { FocusBlur } from '../../retouch/focus-blur';
import type { PanelProps } from './panel-props';

/** Tilt-shift (EDT-23): tap where to focus, then shape the sharp area and the blur. */
export function BlurPanel({ recipe, update }: PanelProps) {
  const focus = recipe.focusBlur;
  const change = (next: Partial<FocusBlur>, key?: string) => {
    update({ focusBlur: { ...focus, ...next } }, key);
  };
  return (
    <>
      <Text style={styles.hint}>{strings.edit.blur.hint}</Text>
      <View style={styles.row}>
        {(['band', 'radial'] as const).map((shape) => (
          <Chip
            key={shape}
            label={strings.edit.blur.shapes[shape]}
            selected={focus.amount > 0 && focus.shape === shape}
            onPress={() => {
              change({ shape, amount: focus.amount > 0 ? focus.amount : 0.6 });
            }}
          />
        ))}
        <Chip
          label={strings.edit.blur.off}
          selected={focus.amount === 0}
          onPress={() => {
            change({ amount: 0 });
          }}
        />
      </View>
      {focus.amount > 0 && (
        <>
          <Slider
            label={strings.edit.blur.amount}
            value={focus.amount}
            min={0.05}
            max={1}
            onChange={(amount) => {
              change({ amount }, 'focus-amount');
            }}
          />
          <Slider
            label={strings.edit.blur.size}
            value={focus.size}
            min={0.03}
            max={0.6}
            onChange={(size) => {
              change({ size }, 'focus-size');
            }}
          />
          {focus.shape === 'band' && (
            <Slider
              label={strings.edit.blur.angle}
              value={focus.angle}
              min={-90}
              max={90}
              centered
              formatValue={(degrees) => `${String(Math.round(degrees))}°`}
              onChange={(angle) => {
                change({ angle }, 'focus-angle');
              }}
            />
          )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

import { StyleSheet, View } from 'react-native';

import { strings } from '../../i18n';
import { ColorPalette } from '../../ui/color-palette';
import { Slider } from '../../ui/slider';
import { Text } from '../../ui/text';
import { colors, spacing } from '../../ui/theme';
import { MAKEUP_PALETTES, MAKEUP_PARTS, type Makeup } from './makeup';

/** Makeup (BTY-07): an amount and a colour per part; teeth and under-eyes (BTY-09/10). */
export function MakeupControls({
  makeup,
  onChange,
}: {
  readonly makeup: Makeup;
  readonly onChange: (makeup: Makeup) => void;
}) {
  return (
    <>
      <Text style={styles.heading}>{strings.makeup.title}</Text>
      {MAKEUP_PARTS.map((part) => (
        <View key={part} style={styles.part}>
          <Slider
            label={strings.makeup.parts[part]}
            value={makeup[part]}
            min={0}
            max={1}
            onChange={(value) => {
              onChange({ ...makeup, [part]: value });
            }}
          />
          {makeup[part] > 0 && (
            <ColorPalette
              colors={MAKEUP_PALETTES[part]}
              color={makeup[`${part}Color`]}
              onChange={(color) => {
                onChange({ ...makeup, [`${part}Color`]: color });
              }}
            />
          )}
        </View>
      ))}
      {(['teeth', 'underEye'] as const).map((key) => (
        <Slider
          key={key}
          label={strings.makeup[key]}
          value={makeup[key]}
          min={0}
          max={1}
          onChange={(value) => {
            onChange({ ...makeup, [key]: value });
          }}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.sm },
  part: { gap: spacing.xs },
});

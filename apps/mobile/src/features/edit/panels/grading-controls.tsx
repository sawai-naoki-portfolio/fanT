import { GRADE_RANGES, type GradeRange } from '@fant/filters';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { Slider } from '../../../ui/slider';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import type { PanelProps } from './panel-props';

/** Colour grading (EDT-21): a hue and a strength for the shadows, midtones and highlights. */
export function GradingControls({ recipe, update }: PanelProps) {
  const [range, setRange] = useState<GradeRange>('Shadows');
  const hue = `grade${range}Hue` as const;
  const amount = `grade${range}Amount` as const;
  return (
    <>
      <Text style={styles.heading}>{strings.edit.grading.title}</Text>
      <View style={styles.row}>
        {GRADE_RANGES.map((candidate) => (
          <Chip
            key={candidate}
            label={strings.edit.grading.ranges[candidate]}
            selected={range === candidate}
            onPress={() => {
              setRange(candidate);
            }}
          />
        ))}
      </View>
      <Slider
        label={strings.edit.grading.hue}
        value={recipe.detail[hue]}
        min={0}
        max={360}
        formatValue={(degrees) => `${String(Math.round(degrees))}°`}
        onChange={(value) => {
          update({ detail: { ...recipe.detail, [hue]: value } }, hue);
        }}
      />
      <Slider
        label={strings.edit.grading.amount}
        value={recipe.detail[amount]}
        min={0}
        max={1}
        onChange={(value) => {
          update({ detail: { ...recipe.detail, [amount]: value } }, amount);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

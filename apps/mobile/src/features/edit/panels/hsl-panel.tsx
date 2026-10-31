import { DETAIL_PARAM_RANGES, HSL_BANDS, type HslBand } from '@fant/filters';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { spacing } from '../../../ui/theme';
import type { PanelProps } from './panel-props';
import { ParamSliders } from '../../../ui/param-sliders';

const PARTS = ['Hue', 'Saturation', 'Luminance'] as const;

/** Hue, saturation and lightness per colour band (EDT-08). */
export function HslPanel({ recipe, update }: PanelProps) {
  const [band, setBand] = useState<HslBand>('red');
  const names = PARTS.map((part) => `${band}${part}` as const);
  return (
    <>
      <View style={styles.bands}>
        {HSL_BANDS.map((candidate) => (
          <Chip
            key={candidate}
            label={strings.edit.hsl.bands[candidate]}
            selected={band === candidate}
            onPress={() => {
              setBand(candidate);
            }}
          />
        ))}
      </View>
      <ParamSliders
        names={names}
        ranges={DETAIL_PARAM_RANGES}
        values={recipe.detail}
        label={(name) => strings.edit.hsl.parts[name.slice(band.length) as (typeof PARTS)[number]]}
        onChange={(name, value) => {
          update({ detail: { ...recipe.detail, [name]: value } }, name);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bands: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

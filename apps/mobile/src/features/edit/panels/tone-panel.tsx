import {
  CURVE_CHANNELS,
  CURVE_POINTS,
  DETAIL_PARAM_RANGES,
  type CurveChannel,
  type DetailParamName,
} from '@fant/filters';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { ParamSliders } from '../../../ui/param-sliders';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import type { PanelProps } from './panel-props';

const TONE = ['sharpen', 'highlights', 'shadows', 'whites', 'blacks', 'vibrance'] as const;

/** The brightness curve, or one colour channel's (EDT-32). */
type CurveTarget = 'Luma' | CurveChannel;

function curveNames(target: CurveTarget): DetailParamName[] {
  return CURVE_POINTS.map((point) =>
    target === 'Luma' ? (`curve${point}` as const) : (`curve${target}${point}` as const),
  );
}

/**
 * Sharpening and tone (EDT-07), white and black levels (EDT-31), and the
 * four-point tone curves for brightness (EDT-09) and each channel (EDT-32).
 */
export function TonePanel({ recipe, update }: PanelProps) {
  const [target, setTarget] = useState<CurveTarget>('Luma');
  const change = (name: DetailParamName, value: number) => {
    update({ detail: { ...recipe.detail, [name]: value } }, name);
  };
  const names = curveNames(target);
  return (
    <>
      <ParamSliders
        names={TONE}
        ranges={DETAIL_PARAM_RANGES}
        values={recipe.detail}
        label={(name) => strings.edit.detail[name]}
        onChange={change}
      />
      <Text style={styles.heading}>{strings.edit.curve.title}</Text>
      <View style={styles.row}>
        {(['Luma', ...CURVE_CHANNELS] as const).map((candidate) => (
          <Chip
            key={candidate}
            label={strings.edit.curve.targets[candidate]}
            selected={target === candidate}
            onPress={() => {
              setTarget(candidate);
            }}
          />
        ))}
      </View>
      <ParamSliders
        names={names}
        ranges={DETAIL_PARAM_RANGES}
        values={recipe.detail}
        label={(name) => strings.edit.curve.points[CURVE_POINTS[names.indexOf(name)] ?? 'Shadows']}
        onChange={change}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

import { LIGHT_EFFECTS, LIGHT_PARAM_RANGES } from '@fant/filters';
import { StyleSheet } from 'react-native';

import { strings } from '../../../i18n';
import { ParamSliders } from '../../../ui/param-sliders';
import { Text } from '../../../ui/text';
import { colors } from '../../../ui/theme';
import type { PanelProps } from './panel-props';

/** Light and weather (EDT-24): sun rays and a flare from a tapped point, mist, rain and snow. */
export function LightPanel({ recipe, update }: PanelProps) {
  return (
    <>
      <Text style={styles.hint}>{strings.edit.light.hint}</Text>
      <ParamSliders
        names={LIGHT_EFFECTS}
        ranges={LIGHT_PARAM_RANGES}
        values={recipe.light}
        label={(name) => strings.edit.light[name]}
        onChange={(name, value) => {
          update({ light: { ...recipe.light, [name]: value } }, name);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 13 },
});

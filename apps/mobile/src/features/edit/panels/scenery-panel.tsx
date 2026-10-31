import { DETAIL_PARAM_RANGES } from '@fant/filters';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { ParamSliders } from '../../../ui/param-sliders';
import { spacing } from '../../../ui/theme';
import { SCENERY_LOOKS, withSceneryLook, type SceneryLook } from '../scenery-looks';
import type { PanelProps } from './panel-props';

const SCENERY = ['dehaze', 'clarity', 'sky', 'sunset'] as const;

/**
 * Tools for landscapes, which work without people in the photo: one-tap looks such
 * as HDR and drama (EDT-22) and the scenery sliders (EDT-15).
 */
export function SceneryPanel({ recipe, update }: PanelProps) {
  return (
    <>
      <View style={styles.row}>
        {(Object.keys(SCENERY_LOOKS) as SceneryLook[]).map((look) => (
          <Chip
            key={look}
            label={strings.edit.looks[look]}
            selected={false}
            onPress={() => {
              update(withSceneryLook(recipe, look));
            }}
          />
        ))}
      </View>
      <ParamSliders
        names={SCENERY}
        ranges={DETAIL_PARAM_RANGES}
        values={recipe.detail}
        label={(name) => strings.edit.scenery[name]}
        onChange={(name, value) => {
          update({ detail: { ...recipe.detail, [name]: value } }, name);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

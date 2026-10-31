import { StyleSheet, View } from 'react-native';

import { personSegmentationSupported } from '../../../../modules/person-segmentation/src';
import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import { BACKDROPS } from '../../photo/backdrops';
import type { PanelProps } from './panel-props';

/** Puts the people in front of a new background, cut out on the device (EDT-16). */
export function BackgroundPanel({ recipe, update }: PanelProps) {
  if (!personSegmentationSupported) {
    return <Text style={styles.hint}>{strings.edit.background.unsupported}</Text>;
  }
  return (
    <>
      <Text style={styles.hint}>{strings.edit.background.hint}</Text>
      <View style={styles.row}>
        <Chip
          label={strings.edit.background.none}
          selected={recipe.backdrop === null}
          onPress={() => {
            update({ backdrop: null });
          }}
        />
        {BACKDROPS.map((backdrop) => (
          <Chip
            key={backdrop.id}
            label={backdrop.emoji}
            selected={recipe.backdrop === backdrop.id}
            onPress={() => {
              update({ backdrop: backdrop.id });
            }}
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 13 },
});

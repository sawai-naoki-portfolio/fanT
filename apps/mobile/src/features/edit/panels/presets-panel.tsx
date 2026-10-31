import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Button } from '../../../ui/button';
import { Chip } from '../../../ui/chip';
import { showMessage } from '../../../ui/dialogs';
import { IconButton } from '../../../ui/icon-button';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import { lookOf, withLook } from '../../looks/look';
import { usePresets } from '../../looks/presets-store';
import type { PanelProps } from './panel-props';

/** The user's own presets (EDT-33): save the current look, apply or delete saved ones. */
export function PresetsPanel({ recipe, update }: PanelProps) {
  const presets = usePresets((state) => state.presets);
  return (
    <>
      <Text style={styles.hint}>{strings.edit.presets.hint}</Text>
      <Button
        label={strings.edit.presets.save}
        variant="secondary"
        onPress={() => {
          const saved = usePresets
            .getState()
            .add(strings.edit.presets.name(presets.length + 1), lookOf(recipe));
          showMessage(saved ? strings.edit.presets.saved : strings.edit.presets.full);
        }}
      />
      {presets.map((preset) => (
        <View key={preset.id} style={styles.row}>
          <Chip
            label={preset.name}
            selected={false}
            onPress={() => {
              update(withLook(recipe, preset.look));
            }}
          />
          <IconButton
            icon="trash-outline"
            variant="plain"
            label={strings.edit.presets.remove(preset.name)}
            onPress={() => {
              usePresets.getState().remove(preset.id);
            }}
          />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

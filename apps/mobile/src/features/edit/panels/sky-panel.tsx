import { StyleSheet, View } from 'react-native';

import { skyMaskImage } from '../../../engine/sky-mask-image';
import type { SkImage } from '../../../engine/skia';
import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import { findBackdrop, SKY_BACKDROP_IDS } from '../../photo/backdrops';
import type { SkyEdit } from '../../sky/sky-edit';
import { AreaToneSliders } from './area-tone-sliders';
import type { PanelProps } from './panel-props';

/** The sky alone, found on the device (EDT-25): recolour it or put a new one in. */
export function SkyPanel({
  recipe,
  update,
  original,
}: PanelProps & { readonly original: SkImage }) {
  if (skyMaskImage(original) === null) {
    return <Text style={styles.hint}>{strings.edit.sky.none}</Text>;
  }
  const change = (next: Partial<SkyEdit>, key?: string) => {
    update({ sky: { ...recipe.sky, ...next } }, key);
  };
  return (
    <>
      <Text style={styles.hint}>{strings.edit.sky.hint}</Text>
      <View style={styles.row}>
        <Chip
          label={strings.edit.sky.keep}
          selected={recipe.sky.backdrop === null}
          onPress={() => {
            change({ backdrop: null });
          }}
        />
        {SKY_BACKDROP_IDS.map((id) => (
          <Chip
            key={id}
            label={findBackdrop(id)?.emoji ?? id}
            selected={recipe.sky.backdrop === id}
            onPress={() => {
              change({ backdrop: id });
            }}
          />
        ))}
      </View>
      <AreaToneSliders
        tone={recipe.sky}
        undoKey="sky"
        onChange={(tone, key) => {
          change(tone, key);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

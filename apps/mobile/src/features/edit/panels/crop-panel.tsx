import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { IconButton } from '../../../ui/icon-button';
import { signedPercent } from '../../../ui/param-sliders';
import { Slider } from '../../../ui/slider';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import {
  ASPECT_VALUES,
  centerCrop,
  rotatedSize,
  turnClockwise,
  type Size,
} from '../../photo/geometry';
import { ASPECT_RATIOS, FULL_CROP, type AspectRatio } from '../../photo/recipe';
import type { PanelProps } from './panel-props';

/** The slider covers a tilted horizon; finer than the recipe's limit, for precision. */
const STRAIGHTEN_RANGE = 15;
/** Crop to an aspect ratio, rotate, straighten (EDT-14), correct perspective (EDT-18) and flip (EDT-03). */
export function CropPanel({
  recipe,
  update,
  originalSize,
}: PanelProps & { readonly originalSize: Size }) {
  const setAspect = (aspect: AspectRatio | null) => {
    const turned = rotatedSize(originalSize, recipe.transform.rotation);
    update({
      transform: {
        ...recipe.transform,
        crop: aspect === null ? FULL_CROP : centerCrop(turned, ASPECT_VALUES[aspect]),
      },
    });
  };
  return (
    <>
      <Text style={styles.hint}>{strings.edit.cropHint}</Text>
      <View style={styles.row}>
        <Chip
          label={strings.edit.original}
          selected={recipe.transform.crop === FULL_CROP}
          onPress={() => {
            setAspect(null);
          }}
        />
        {ASPECT_RATIOS.map((aspect) => (
          <Chip
            key={aspect}
            label={aspect}
            selected={false}
            onPress={() => {
              setAspect(aspect);
            }}
          />
        ))}
      </View>
      <Slider
        label={strings.edit.straighten}
        value={recipe.transform.straighten}
        min={-STRAIGHTEN_RANGE}
        max={STRAIGHTEN_RANGE}
        centered
        formatValue={(degrees) => `${degrees > 0 ? '+' : ''}${degrees.toFixed(1)}°`}
        onChange={(degrees) => {
          // Snaps to level near zero, where a steady hand cannot stop exactly.
          const straighten = Math.abs(degrees) < 0.25 ? 0 : degrees;
          update({ transform: { ...recipe.transform, straighten } }, 'straighten');
        }}
      />
      {(['vertical', 'horizontal'] as const).map((axis) => (
        <Slider
          key={axis}
          label={strings.edit.perspective[axis]}
          value={recipe.transform.perspective[axis]}
          min={-1}
          max={1}
          centered
          formatValue={signedPercent}
          onChange={(value) => {
            const perspective = { ...recipe.transform.perspective, [axis]: value };
            update({ transform: { ...recipe.transform, perspective } }, `perspective-${axis}`);
          }}
        />
      ))}
      <View style={styles.row}>
        <IconButton
          icon="refresh"
          label={strings.edit.rotate}
          onPress={() => {
            update({
              transform: {
                ...recipe.transform,
                rotation: turnClockwise(recipe.transform.rotation),
                crop: FULL_CROP,
              },
            });
          }}
        />
        <IconButton
          icon="swap-horizontal"
          label={strings.edit.flip}
          onPress={() => {
            update({ transform: { ...recipe.transform, mirror: !recipe.transform.mirror } });
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 13 },
});

import { MAX_LOCAL_ADJUSTMENTS, type LocalAdjustment, type LocalShape } from '@fant/filters';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { IconButton } from '../../../ui/icon-button';
import { signedPercent } from '../../../ui/param-sliders';
import { Slider } from '../../../ui/slider';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import type { PanelProps, PhotoPoint } from './panel-props';

/** A new area of each shape: a brighter circle, or a sky darkened from the top. */
const NEW_AREA: Record<LocalShape, Omit<LocalAdjustment, 'x' | 'y'>> = {
  radial: {
    shape: 'radial',
    radius: 0.25,
    feather: 0.6,
    angle: 0,
    brightness: 0.3,
    saturation: 0,
    temperature: 0,
  },
  linear: {
    shape: 'linear',
    radius: 0.15,
    feather: 0,
    angle: 0,
    brightness: -0.3,
    saturation: 0,
    temperature: 0,
  },
};

/** A new area at a tapped point, or `null` when the photo already has the most it can. */
export function addLocalArea(
  local: readonly LocalAdjustment[],
  point: PhotoPoint,
  shape: LocalShape,
): LocalAdjustment[] | null {
  if (local.length >= MAX_LOCAL_ADJUSTMENTS) return null;
  return [...local, { ...NEW_AREA[shape], x: point.x, y: point.y }];
}

type SliderKey = 'radius' | 'feather' | 'angle' | 'brightness' | 'saturation' | 'temperature';

const COLOR_SLIDERS = [
  { key: 'brightness', min: -1, max: 1 },
  { key: 'saturation', min: -1, max: 1 },
  { key: 'temperature', min: -1, max: 1 },
] as const;

const SLIDERS: Record<LocalShape, readonly { key: SliderKey; min: number; max: number }[]> = {
  radial: [
    { key: 'radius', min: 0.02, max: 1 },
    { key: 'feather', min: 0, max: 1 },
    ...COLOR_SLIDERS,
  ],
  linear: [
    { key: 'radius', min: 0.02, max: 1 },
    { key: 'angle', min: -180, max: 180 },
    ...COLOR_SLIDERS,
  ],
};

function formatOf(key: SliderKey, min: number) {
  if (key === 'angle') return (degrees: number) => `${String(Math.round(degrees))}°`;
  return min < 0 ? signedPercent : undefined;
}

/**
 * Areas adjusted on their own: circles (EDT-10) and graduated filters (EDT-17).
 * Pick a shape, then tap the photo to add one there.
 */
export function LocalPanel({
  recipe,
  update,
  selected,
  onSelect,
  shape,
  onShape,
}: PanelProps & {
  readonly selected: number;
  readonly onSelect: (index: number) => void;
  /** The shape the next tap adds. */
  readonly shape: LocalShape;
  readonly onShape: (shape: LocalShape) => void;
}) {
  const area = recipe.local[selected];
  const replace = (next: LocalAdjustment | null) => {
    update(
      {
        local:
          next === null
            ? recipe.local.filter((_, index) => index !== selected)
            : recipe.local.map((item, index) => (index === selected ? next : item)),
      },
      next === null ? undefined : `local${String(selected)}`,
    );
  };
  return (
    <>
      <View style={styles.row}>
        {(['radial', 'linear'] as const).map((candidate) => (
          <Chip
            key={candidate}
            label={strings.edit.local.shapes[candidate]}
            selected={shape === candidate}
            onPress={() => {
              onShape(candidate);
            }}
          />
        ))}
      </View>
      <Text style={styles.hint}>{strings.edit.local.hints[shape]}</Text>
      <View style={styles.row}>
        {recipe.local.map((_, index) => (
          <Chip
            key={String(index)}
            label={strings.edit.local.area(index + 1)}
            selected={index === selected}
            onPress={() => {
              onSelect(index);
            }}
          />
        ))}
      </View>
      {area !== undefined && (
        <>
          {SLIDERS[area.shape].map(({ key, min, max }) => (
            <Slider
              key={key}
              label={
                area.shape === 'linear' && key === 'radius'
                  ? strings.edit.local.width
                  : strings.edit.local[key]
              }
              value={area[key]}
              min={min}
              max={max}
              centered={min < 0}
              formatValue={formatOf(key, min)}
              onChange={(value) => {
                replace({ ...area, [key]: value });
              }}
            />
          ))}
          <IconButton
            icon="trash-outline"
            label={strings.edit.local.remove}
            style={styles.remove}
            onPress={() => {
              replace(null);
              onSelect(Math.max(0, selected - 1));
            }}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  remove: { alignSelf: 'flex-end' },
});

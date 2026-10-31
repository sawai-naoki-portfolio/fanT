import { StyleSheet, View } from 'react-native';

import { personSegmentationSupported } from '../../../../modules/person-segmentation/src';
import { strings } from '../../../i18n';
import { Button } from '../../../ui/button';
import { Chip } from '../../../ui/chip';
import { Slider } from '../../../ui/slider';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import type { AreaTone } from '../../selection/area-tone';
import type { useSelectTool } from '../tools/use-select-tool';
import { AreaToneSliders } from './area-tone-sliders';
import type { PanelProps } from './panel-props';

/**
 * Adjusting one part of the photo: the people or the background, cut out on the
 * device (EDT-34), or an area painted with the brush (EDT-35).
 */
export function SelectPanel({
  recipe,
  update,
  tool,
}: PanelProps & { readonly tool: ReturnType<typeof useSelectTool> }) {
  const { mode } = tool;
  const tone: AreaTone = mode === 'brush' ? recipe.brush.tone : recipe.selective[mode];
  const setTone = (next: AreaTone, key: string) => {
    if (mode === 'brush') update({ brush: { ...recipe.brush, tone: next } }, key);
    else update({ selective: { ...recipe.selective, [mode]: next } }, key);
  };
  const needsPeople = mode !== 'brush' && !personSegmentationSupported;
  return (
    <>
      <View style={styles.row}>
        {(['brush', 'people', 'background'] as const).map((candidate) => (
          <Chip
            key={candidate}
            label={strings.edit.select.modes[candidate]}
            selected={mode === candidate}
            onPress={() => {
              tool.onMode(candidate);
            }}
          />
        ))}
      </View>
      <Text style={styles.hint}>
        {needsPeople ? strings.edit.select.unsupported : strings.edit.select.hints[mode]}
      </Text>
      {mode === 'brush' && (
        <>
          <Slider
            label={strings.edit.select.brushSize}
            value={tool.brushSize}
            min={0.01}
            max={0.15}
            onChange={tool.onBrushSize}
          />
          <View style={styles.row}>
            <Button
              label={strings.edit.select.undoStroke}
              variant="secondary"
              disabled={recipe.brush.strokes.length === 0}
              onPress={() => {
                update({ brush: { ...recipe.brush, strokes: recipe.brush.strokes.slice(0, -1) } });
              }}
            />
          </View>
        </>
      )}
      {!needsPeople && <AreaToneSliders tone={tone} undoKey={mode} onChange={setTone} />}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

import { BODY_PARAM_RANGES } from '@fant/filters';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Button } from '../../../ui/button';
import { Chip } from '../../../ui/chip';
import { ColorPalette } from '../../../ui/color-palette';
import { ParamSliders } from '../../../ui/param-sliders';
import { Slider } from '../../../ui/slider';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import { HAIR_COLORS } from '../../retouch/retouch';
import type { PanelProps } from './panel-props';

/** What a tap on the photo does in the retouch tab. */
export type RetouchTool = 'heal' | 'body';

const BODY_SLIDERS = ['legs', 'slim'] as const;

/**
 * Retouching (BTY-11, EDT-11–13): blemishes and the body's lines are placed by
 * tapping the photo; background blur and hair colour use the person cut-out.
 */
export function RetouchPanel({
  recipe,
  update,
  tool,
  onTool,
  healSize,
  onHealSize,
}: PanelProps & {
  readonly tool: RetouchTool;
  readonly onTool: (tool: RetouchTool) => void;
  readonly healSize: number;
  readonly onHealSize: (size: number) => void;
}) {
  return (
    <>
      <View style={styles.row}>
        {(['heal', 'body'] as const).map((candidate) => (
          <Chip
            key={candidate}
            label={strings.retouch.tools[candidate]}
            selected={tool === candidate}
            onPress={() => {
              onTool(candidate);
            }}
          />
        ))}
      </View>
      <Text style={styles.hint}>{strings.retouch.hints[tool]}</Text>
      {tool === 'heal' ? (
        <>
          <Slider
            label={strings.retouch.healSize}
            value={healSize}
            min={0.01}
            max={0.08}
            onChange={onHealSize}
          />
          <View style={styles.row}>
            <Button
              label={strings.retouch.undoSpot}
              variant="secondary"
              disabled={recipe.heal.length === 0}
              onPress={() => {
                update({ heal: recipe.heal.slice(0, -1) });
              }}
            />
          </View>
        </>
      ) : (
        <ParamSliders
          names={BODY_SLIDERS}
          ranges={BODY_PARAM_RANGES}
          values={recipe.body}
          label={(name) => strings.retouch.body[name]}
          onChange={(name, value) => {
            update({ body: { ...recipe.body, [name]: value } }, name);
          }}
        />
      )}
      <Slider
        label={strings.retouch.backgroundBlur}
        value={recipe.backgroundBlur}
        min={0}
        max={1}
        onChange={(backgroundBlur) => {
          update({ backgroundBlur }, 'backgroundBlur');
        }}
      />
      <Slider
        label={strings.retouch.hair}
        value={recipe.hair.amount}
        min={0}
        max={1}
        onChange={(amount) => {
          update({ hair: { ...recipe.hair, amount } }, 'hair');
        }}
      />
      {recipe.hair.amount > 0 && (
        <ColorPalette
          colors={HAIR_COLORS}
          color={recipe.hair.color}
          onChange={(color) => {
            update({ hair: { ...recipe.hair, color } });
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 13 },
});

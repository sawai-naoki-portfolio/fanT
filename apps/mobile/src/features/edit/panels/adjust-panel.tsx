import { ADJUST_PARAM_RANGES, type AdjustParamName } from '@fant/filters';

import { strings } from '../../../i18n';
import { Button } from '../../../ui/button';
import { ParamSliders } from '../../../ui/param-sliders';
import type { PanelProps } from './panel-props';

const ADJUSTMENTS: readonly AdjustParamName[] = [
  'brightness',
  'contrast',
  'saturation',
  'temperature',
  'tint',
];

/** Basic corrections (EDT-03, tint EDT-31), with one-tap auto adjustment (EDT-19) above them. */
export function AdjustPanel({
  recipe,
  update,
  onAuto,
}: PanelProps & { readonly onAuto: () => void }) {
  return (
    <>
      <Button label={strings.edit.auto} variant="secondary" onPress={onAuto} />
      <ParamSliders
        names={ADJUSTMENTS}
        ranges={ADJUST_PARAM_RANGES}
        values={recipe.adjust}
        label={(name) => strings.edit[name]}
        onChange={(name, value) => {
          update({ adjust: { ...recipe.adjust, [name]: value } }, name);
        }}
      />
    </>
  );
}

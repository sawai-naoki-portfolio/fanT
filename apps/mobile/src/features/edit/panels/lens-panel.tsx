import { LENS_PARAM_RANGES, type LensParamName } from '@fant/filters';

import { strings } from '../../../i18n';
import { ParamSliders } from '../../../ui/param-sliders';
import type { PanelProps } from './panel-props';

const LENS: readonly LensParamName[] = ['distortion', 'vignette', 'noise', 'colorNoise'];

/** Corrections of the camera itself: lens distortion, dark corners and noise (EDT-20). */
export function LensPanel({ recipe, update }: PanelProps) {
  return (
    <ParamSliders
      names={LENS}
      ranges={LENS_PARAM_RANGES}
      values={recipe.lens}
      label={(name) => strings.edit.lens[name]}
      onChange={(name, value) => {
        update({ lens: { ...recipe.lens, [name]: value } }, name);
      }}
    />
  );
}

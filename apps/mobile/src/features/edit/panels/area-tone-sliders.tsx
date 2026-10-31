import { strings } from '../../../i18n';
import { signedPercent } from '../../../ui/param-sliders';
import { Slider } from '../../../ui/slider';
import type { AreaTone } from '../../selection/area-tone';

const NAMES = ['brightness', 'saturation', 'warmth'] as const;

/**
 * Brightness, colour and warmth of one part of the photo: the sky, the people,
 * the background or a painted area. `undoKey` groups a drag into one undo step.
 */
export function AreaToneSliders({
  tone,
  undoKey,
  onChange,
}: {
  readonly tone: AreaTone;
  readonly undoKey: string;
  readonly onChange: (tone: AreaTone, key: string) => void;
}) {
  return NAMES.map((name) => (
    <Slider
      key={name}
      label={strings.edit.areaTone[name]}
      value={tone[name]}
      min={-1}
      max={1}
      centered
      formatValue={signedPercent}
      onChange={(value) => {
        onChange({ ...tone, [name]: value }, `${undoKey}-${name}`);
      }}
    />
  ));
}

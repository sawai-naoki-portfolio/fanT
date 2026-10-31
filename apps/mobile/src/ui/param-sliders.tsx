import type { ParamRange } from '@fant/filters';

import { Slider } from './slider';

/** "+25" / "-40": for two-sided values. */
export function signedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${String(Math.round(value * 100))}`;
}

/** One slider per parameter, with the bounds of its range (DRY for every editor panel). */
export function ParamSliders<Name extends string>({
  names,
  ranges,
  values,
  label,
  onChange,
}: {
  readonly names: readonly Name[];
  readonly ranges: Readonly<Record<Name, ParamRange>>;
  readonly values: Readonly<Record<Name, number>>;
  readonly label: (name: Name) => string;
  readonly onChange: (name: Name, value: number) => void;
}) {
  return names.map((name) => {
    const { min, max } = ranges[name];
    const centered = min < 0;
    return (
      <Slider
        key={name}
        label={label(name)}
        value={values[name]}
        min={min}
        max={max}
        centered={centered}
        formatValue={centered ? signedPercent : undefined}
        onChange={(value) => {
          onChange(name, value);
        }}
      />
    );
  });
}

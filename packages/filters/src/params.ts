export interface ParamRange {
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
}

export type ParamValues<Name extends string> = Readonly<Record<Name, number>>;

export interface ParamSpec<Name extends string> {
  readonly defaults: ParamValues<Name>;
  /**
   * Turns untrusted input (e.g. downloaded definitions) into safe shader parameters:
   * missing or non-finite values fall back to defaults, the rest are clamped to range,
   * and unknown keys are dropped.
   */
  readonly normalize: (input?: Partial<Record<Name, unknown>>) => ParamValues<Name>;
}

/** Derives frozen defaults and a normalizer from a single table of parameter ranges. */
export function defineParams<Name extends string>(
  ranges: Readonly<Record<Name, ParamRange>>,
): ParamSpec<Name> {
  const names = Object.keys(ranges) as Name[];
  const defaults = Object.freeze(
    Object.fromEntries(names.map((name) => [name, ranges[name].defaultValue])),
  ) as ParamValues<Name>;

  const normalize = (input: Partial<Record<Name, unknown>> = {}): ParamValues<Name> => {
    const params = {} as Record<Name, number>;
    for (const name of names) {
      const { min, max, defaultValue } = ranges[name];
      const value = input[name];
      params[name] =
        typeof value === 'number' && Number.isFinite(value)
          ? Math.min(max, Math.max(min, value))
          : defaultValue;
    }
    return Object.freeze(params);
  };

  return { defaults, normalize };
}

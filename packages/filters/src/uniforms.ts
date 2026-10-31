/**
 * Uniform reflection exposed by both react-native-skia's `SkRuntimeEffect`
 * and CanvasKit's `RuntimeEffect`.
 */
export interface UniformLayout {
  getUniformCount(): number;
  getUniformFloatCount(): number;
  getUniformName(index: number): string;
  getUniform(index: number): {
    readonly slot: number;
    readonly columns: number;
    readonly rows: number;
  };
}

export type UniformValues = Readonly<Record<string, number | readonly number[]>>;

/**
 * Packs named uniform values into the flat float array that
 * `makeShaderWithChildren` expects, following the shader's declaration order.
 * Throws when a uniform is missing or has the wrong number of components.
 *
 * Marked as a worklet so it can run on the camera frame thread.
 */
export function packUniforms(layout: UniformLayout, values: UniformValues): number[] {
  'worklet';
  const packed = new Array<number>(layout.getUniformFloatCount()).fill(0);
  const count = layout.getUniformCount();
  for (let index = 0; index < count; index++) {
    const name = layout.getUniformName(index);
    const value = values[name];
    if (value === undefined) {
      throw new Error(`Missing value for uniform "${name}"`);
    }
    const components = typeof value === 'number' ? [value] : value;
    const { slot, columns, rows } = layout.getUniform(index);
    if (components.length !== columns * rows) {
      throw new Error(
        `Uniform "${name}" expects ${String(columns * rows)} floats, got ${String(components.length)}`,
      );
    }
    for (let offset = 0; offset < components.length; offset++) {
      packed[slot + offset] = components[offset] ?? 0;
    }
  }
  return packed;
}

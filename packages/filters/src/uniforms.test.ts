import { describe, expect, it } from 'vitest';

import { packUniforms, type UniformLayout } from './uniforms';

interface FakeUniform {
  readonly name: string;
  readonly slot: number;
  readonly columns: number;
}

function layoutOf(uniforms: readonly FakeUniform[]): UniformLayout {
  return {
    getUniformCount: () => uniforms.length,
    getUniformFloatCount: () => uniforms.reduce((total, { columns }) => total + columns, 0),
    getUniformName: (index) => uniforms[index]?.name ?? '',
    getUniform: (index) => ({
      slot: uniforms[index]?.slot ?? 0,
      columns: uniforms[index]?.columns ?? 0,
      rows: 1,
    }),
  };
}

const LAYOUT = layoutOf([
  { name: 'resolution', slot: 0, columns: 2 },
  { name: 'intensity', slot: 2, columns: 1 },
]);

describe('packUniforms', () => {
  it('places each value at its declared slot', () => {
    expect(packUniforms(LAYOUT, { intensity: 0.5, resolution: [640, 480] })).toEqual([
      640, 480, 0.5,
    ]);
  });

  it('ignores values the shader does not declare', () => {
    expect(packUniforms(LAYOUT, { intensity: 1, resolution: [1, 2], extra: 9 })).toEqual([1, 2, 1]);
  });

  it('rejects a missing uniform', () => {
    expect(() => packUniforms(LAYOUT, { resolution: [1, 2] })).toThrow(/"intensity"/);
  });

  it('rejects a value with the wrong number of components', () => {
    expect(() => packUniforms(LAYOUT, { intensity: 1, resolution: [1] })).toThrow(
      /expects 2 floats, got 1/,
    );
  });
});

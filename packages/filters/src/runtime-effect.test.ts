import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  ShaderCompileError,
  type RuntimeEffectFactory,
} from './runtime-effect';

describe('compileRuntimeEffect', () => {
  it('returns the compiled effect', () => {
    const effect = { id: 'effect' };
    const factory: RuntimeEffectFactory<typeof effect> = { Make: () => effect };
    expect(compileRuntimeEffect(factory, 'test', 'source')).toBe(effect);
  });

  it('throws with the compiler message when compilation fails', () => {
    const factory: RuntimeEffectFactory<object> = {
      Make: (_source, onError) => {
        onError?.('error: 1: unknown identifier');
        return null;
      },
    };
    expect(() => compileRuntimeEffect(factory, 'broken', 'source')).toThrow(
      new ShaderCompileError('broken', 'error: 1: unknown identifier'),
    );
  });

  it('still throws when the binding reports no message', () => {
    const factory: RuntimeEffectFactory<object> = { Make: () => null };
    expect(() => compileRuntimeEffect(factory, 'broken', 'source')).toThrow(ShaderCompileError);
  });
});

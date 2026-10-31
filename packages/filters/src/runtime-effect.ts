/**
 * Minimal port over Skia's runtime-effect factory.
 *
 * Both `Skia.RuntimeEffect` (react-native-skia) and `CanvasKit.RuntimeEffect` (web)
 * satisfy this shape, so shader code here never depends on a specific Skia binding.
 */
export interface RuntimeEffectFactory<TEffect> {
  Make(source: string, onError?: (message: string) => void): TEffect | null;
}

export class ShaderCompileError extends Error {
  override readonly name = 'ShaderCompileError';

  constructor(
    readonly shaderName: string,
    readonly details: string,
  ) {
    super(`Failed to compile shader "${shaderName}"${details ? `: ${details}` : ''}`);
  }
}

/** Compiles an SkSL source, throwing instead of returning `null` on failure. */
export function compileRuntimeEffect<TEffect>(
  factory: RuntimeEffectFactory<TEffect>,
  shaderName: string,
  source: string,
): TEffect {
  let details = '';
  const effect = factory.Make(source, (message) => {
    details = message;
  });
  if (effect === null) {
    throw new ShaderCompileError(shaderName, details);
  }
  return effect;
}

import { compileFilterEffects, type FilterEffects } from '@fant/filters';
import { Skia, type SkShader } from '@shopify/react-native-skia';

let compiled: FilterEffects<SkShader> | undefined;

/**
 * The shared shaders, compiled once for the app's lifetime. A compile failure
 * throws, so the screen's error boundary reports it instead of drawing a blank canvas.
 */
export function filterEffects(): FilterEffects<SkShader> {
  compiled ??= compileFilterEffects(Skia.RuntimeEffect);
  return compiled;
}

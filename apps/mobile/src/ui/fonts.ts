import {
  MPLUSRounded1c_500Medium,
  MPLUSRounded1c_700Bold,
  MPLUSRounded1c_800ExtraBold,
} from '@expo-google-fonts/m-plus-rounded-1c';
import { useFonts } from 'expo-font';

import { DECO_FONT_SOURCES } from '../engine/deco-fonts';

/**
 * M PLUS Rounded 1c (SIL Open Font License): round, friendly Japanese that suits
 * the app. Three weights cover body, emphasis and headings.
 */
const FONT_FAMILIES = {
  regular: 'Rounded-Medium',
  bold: 'Rounded-Bold',
  heavy: 'Rounded-ExtraBold',
} as const;

/** Loads the bundled fonts; `true` when ready or when loading failed (system fonts are used then). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    [FONT_FAMILIES.regular]: MPLUSRounded1c_500Medium,
    [FONT_FAMILIES.bold]: MPLUSRounded1c_700Bold,
    [FONT_FAMILIES.heavy]: MPLUSRounded1c_800ExtraBold,
    // The text fonts (DCO-06), so the font picker can show each in itself.
    ...DECO_FONT_SOURCES,
  });
  return loaded || error !== null;
}

/** The family for a font weight, so styles keep using `fontWeight`. */
export function familyFor(weight: string | number | undefined): string {
  const value = Number(weight ?? 400);
  if (value >= 800) return FONT_FAMILIES.heavy;
  if (value >= 600) return FONT_FAMILIES.bold;
  return FONT_FAMILIES.regular;
}

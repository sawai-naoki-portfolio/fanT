import { DelaGothicOne_400Regular } from '@expo-google-fonts/dela-gothic-one';
import { DotGothic16_400Regular } from '@expo-google-fonts/dotgothic16';
import { HachiMaruPop_400Regular } from '@expo-google-fonts/hachi-maru-pop';
import { MPLUSRounded1c_800ExtraBold } from '@expo-google-fonts/m-plus-rounded-1c';
import { YuseiMagic_400Regular } from '@expo-google-fonts/yusei-magic';
import { Skia, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';

import { reportError } from '../features/analytics/analytics';
import { DECO_FONT_FAMILIES, type BundledFont } from '../features/deco/deco-fonts';

/** The bundled fonts for text (DCO-06), all under the SIL Open Font License. */
const FONT_FILES: Record<BundledFont, number> = {
  rounded: MPLUSRounded1c_800ExtraBold,
  pop: HachiMaruPop_400Regular,
  marker: YuseiMagic_400Regular,
  pixel: DotGothic16_400Regular,
  bold: DelaGothicOne_400Regular,
};

/** For `useFonts`, so the font picker shows each font in itself. */
export const DECO_FONT_SOURCES: Record<string, number> = Object.fromEntries(
  (Object.keys(FONT_FILES) as BundledFont[]).map((font) => [
    DECO_FONT_FAMILIES[font],
    FONT_FILES[font],
  ]),
);

let loaded: SkTypefaceFontProvider | null = null;
let loading: Promise<SkTypefaceFontProvider | null> | null = null;

async function load(): Promise<SkTypefaceFontProvider> {
  const provider = Skia.TypefaceFontProvider.Make();
  for (const font of Object.keys(FONT_FILES) as BundledFont[]) {
    const asset = await Asset.fromModule(FONT_FILES[font]).downloadAsync();
    const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
    try {
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (typeface !== null) provider.registerFont(typeface, DECO_FONT_FAMILIES[font]);
    } finally {
      data.dispose();
    }
  }
  return provider;
}

/**
 * The bundled fonts for Skia text, loaded once for the session; `null` when they
 * cannot be loaded (text then uses the system font).
 */
export function loadDecoFonts(): Promise<SkTypefaceFontProvider | null> {
  loading ??= load()
    .then((provider) => {
      loaded = provider;
      return provider;
    })
    .catch((error: unknown) => {
      reportError(error, 'fonts.deco');
      loading = null;
      return null;
    });
  return loading;
}

/** The bundled fonts once loaded, for screens that draw text. */
export function useDecoFonts(): SkTypefaceFontProvider | null {
  const [fonts, setFonts] = useState(loaded);
  useEffect(() => {
    if (fonts === null) void loadDecoFonts().then(setFonts);
  }, [fonts]);
  return fonts;
}

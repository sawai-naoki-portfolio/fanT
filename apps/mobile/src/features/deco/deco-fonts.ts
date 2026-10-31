/** Fonts for text (DCO-06): the device's own, or one of the bundled ones. */
export const DECO_FONTS = ['system', 'rounded', 'pop', 'marker', 'pixel', 'bold'] as const;
export type DecoFont = (typeof DECO_FONTS)[number];
export type BundledFont = Exclude<DecoFont, 'system'>;

/** Family names the bundled fonts are registered under, for Skia and the app's own text. */
export const DECO_FONT_FAMILIES: Record<BundledFont, string> = {
  rounded: 'Deco-Rounded',
  pop: 'Deco-Pop',
  marker: 'Deco-Marker',
  pixel: 'Deco-Pixel',
  bold: 'Deco-Bold',
};

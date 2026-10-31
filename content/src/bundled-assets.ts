/**
 * Asset files of builtin/, keyed by their path in the manifest, as Metro asset
 * modules (`require` is how Metro bundles images). A test fails if an asset is missing.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles assets via require */
export const BUNDLED_ASSETS: Readonly<Record<string, number>> = {
  'luts/ccd_2005.png': require('../builtin/luts/ccd_2005.png') as number,
  'luts/disposable.png': require('../builtin/luts/disposable.png') as number,
  'luts/instant.png': require('../builtin/luts/instant.png') as number,
  'luts/kiri.png': require('../builtin/luts/kiri.png') as number,
  'luts/night_flash.png': require('../builtin/luts/night_flash.png') as number,
  'luts/puri.png': require('../builtin/luts/puri.png') as number,
  'luts/shinryoku.png': require('../builtin/luts/shinryoku.png') as number,
  'luts/yakei.png': require('../builtin/luts/yakei.png') as number,
  'luts/yuyake.png': require('../builtin/luts/yuyake.png') as number,
};

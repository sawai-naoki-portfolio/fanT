import { parseManifest, type Manifest } from '@fant/content-schema';

import aiStyles from '../builtin/ai-styles.json';
import characters from '../builtin/characters.json';
import ccd2005 from '../builtin/films/ccd_2005.json';
import cinema from '../builtin/films/cinema.json';
import disposable from '../builtin/films/disposable.json';
import instant from '../builtin/films/instant.json';
import keitai from '../builtin/films/keitai.json';
import mono from '../builtin/films/mono.json';
import natural from '../builtin/films/natural.json';
import nightFlash from '../builtin/films/night_flash.json';
import pastel from '../builtin/films/pastel.json';
import kiri from '../builtin/films/kiri.json';
import puri from '../builtin/films/puri.json';
import sakura from '../builtin/films/sakura.json';
import sepia from '../builtin/films/sepia.json';
import shinryoku from '../builtin/films/shinryoku.json';
import summer from '../builtin/films/summer.json';
import toy from '../builtin/films/toy.json';
import vhs from '../builtin/films/vhs.json';
import yakei from '../builtin/films/yakei.json';
import yuyake from '../builtin/films/yuyake.json';
import layouts from '../builtin/layouts.json';
import phrases from '../builtin/phrases.json';
import stamps from '../builtin/stamps.json';

let builtIn: Manifest | undefined;

/**
 * The content that ships inside the app and works offline (CNT-05), validated on
 * first use like any downloaded manifest. A test fails if a file in builtin/ is
 * missing here.
 */
export function builtInManifest(): Manifest {
  builtIn ??= parseManifest({
    schemaVersion: 1,
    // Free films first: the order the camera offers them in.
    films: [
      natural,
      ccd2005,
      disposable,
      instant,
      puri,
      pastel,
      summer,
      sakura,
      shinryoku,
      yuyake,
      keitai,
      mono,
      vhs,
      nightFlash,
      sepia,
      cinema,
      toy,
      kiri,
      yakei,
    ],
    characters,
    layouts,
    stamps,
    phrases,
    aiStyles,
  });
  return builtIn;
}

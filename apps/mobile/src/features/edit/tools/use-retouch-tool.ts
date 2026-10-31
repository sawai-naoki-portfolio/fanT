import { useState } from 'react';

import { strings } from '../../../i18n';
import { showMessage } from '../../../ui/dialogs';
import { addHealSpot } from '../../retouch/retouch';
import type { PanelProps } from '../panels/panel-props';
import type { RetouchTool } from '../panels/retouch-panel';
import type { PhotoTool } from './photo-tool';

/** Blemishes and the body's line (BTY-11, EDT-13): a tap places a spot or moves the line. */
export function useRetouchTool({ recipe, update }: PanelProps) {
  const [mode, setMode] = useState<RetouchTool>('heal');
  const [healSize, setHealSize] = useState(0.025);
  const tool: PhotoTool = {
    onTap: (point) => {
      if (mode === 'body') {
        update({ body: { ...recipe.body, legLine: point.y, bodyX: point.x } });
        return;
      }
      const heal = addHealSpot(recipe.heal, point, healSize);
      if (heal === null) showMessage(strings.retouch.full);
      else update({ heal });
    },
    markers:
      mode === 'heal'
        ? recipe.heal
        : [{ x: recipe.body.bodyX, y: recipe.body.legLine, radius: 0.03, selected: true }],
  };
  return { mode, onMode: setMode, healSize, onHealSize: setHealSize, tool };
}

import type { LocalShape } from '@fant/filters';
import { useState } from 'react';

import { strings } from '../../../i18n';
import { showMessage } from '../../../ui/dialogs';
import { addLocalArea } from '../panels/local-panel';
import type { PanelProps } from '../panels/panel-props';
import type { PhotoTool } from './photo-tool';

/** Local areas and graduated filters (EDT-10, EDT-17): which is selected, what a tap adds. */
export function useLocalTool({ recipe, update }: PanelProps) {
  const [selected, setSelected] = useState(0);
  const [shape, setShape] = useState<LocalShape>('radial');
  const tool: PhotoTool = {
    onTap: (point) => {
      const local = addLocalArea(recipe.local, point, shape);
      if (local === null) {
        showMessage(strings.edit.local.full);
        return;
      }
      update({ local });
      setSelected(local.length - 1);
    },
    markers: recipe.local.map((area, index) => ({
      x: area.x,
      y: area.y,
      radius: area.radius,
      selected: index === selected,
      line: area.shape === 'linear' ? area.angle : undefined,
    })),
  };
  return { selected, onSelect: setSelected, shape, onShape: setShape, tool };
}

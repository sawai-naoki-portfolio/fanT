import type { PanelProps } from '../panels/panel-props';
import type { PhotoTool } from './photo-tool';

/** Light and weather (EDT-24): a tap moves the light source (the sun) there. */
export function useLightTool({ recipe, update }: PanelProps): PhotoTool {
  const { light } = recipe;
  return {
    onTap: (point) => {
      update({ light: { ...light, sourceX: point.x, sourceY: point.y } });
    },
    markers: [{ x: light.sourceX, y: light.sourceY, radius: 0.04, selected: true }],
  };
}

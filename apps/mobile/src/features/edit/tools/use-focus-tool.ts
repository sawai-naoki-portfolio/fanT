import type { PanelProps } from '../panels/panel-props';
import type { PhotoTool } from './photo-tool';

/** Tilt-shift (EDT-23): a tap moves the focus there and turns the blur on. */
export function useFocusTool({ recipe, update }: PanelProps): PhotoTool {
  const focus = recipe.focusBlur;
  return {
    onTap: (point) => {
      update({
        focusBlur: {
          ...focus,
          x: point.x,
          y: point.y,
          amount: focus.amount > 0 ? focus.amount : 0.6,
        },
      });
    },
    markers:
      focus.amount > 0
        ? [
            {
              x: focus.x,
              y: focus.y,
              radius: focus.size,
              selected: true,
              line: focus.shape === 'band' ? focus.angle : undefined,
            },
          ]
        : [],
  };
}

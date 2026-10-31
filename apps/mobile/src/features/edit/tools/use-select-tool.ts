import { useState } from 'react';

/** What the selective tab adjusts: the people, the background or a painted area. */
export type SelectMode = 'people' | 'background' | 'brush';

/** The selective tab's choices (EDT-34, EDT-35): the part to adjust and the brush size. */
export function useSelectTool() {
  const [mode, setMode] = useState<SelectMode>('brush');
  const [brushSize, setBrushSize] = useState(0.05);
  return { mode, onMode: setMode, brushSize, onBrushSize: setBrushSize };
}

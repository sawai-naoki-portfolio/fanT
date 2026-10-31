import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { createWinkDetector, type Eye, type EyeOpenness } from './wink-detector';

/**
 * Turns a stream of eye-openness readings into wink events. Returns a stable
 * callback to feed with readings; `onWink` always sees the latest render's state.
 */
export function useWinkGestures(onWink: (eye: Eye) => void): (eyes: EyeOpenness | null) => void {
  const [detector] = useState(() => createWinkDetector());
  const onWinkRef = useRef(onWink);
  useLayoutEffect(() => {
    onWinkRef.current = onWink;
  });

  return useCallback(
    (eyes: EyeOpenness | null) => {
      const eye = detector.update(eyes, performance.now());
      if (eye !== null) onWinkRef.current(eye);
    },
    [detector],
  );
}

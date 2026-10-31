import { useWinkGestures } from '../gestures/use-wink-gestures';
import { useSettings, type WinkAction } from '../settings/settings-store';

/**
 * Wink gestures as configured in settings (GST-01/03): the eye-openness callback
 * for face tracking, or `null` when winks are off (no eye classification runs then).
 */
export function useWinkActions(onAction: (action: Exclude<WinkAction, 'none'>) => void) {
  const gestures = useSettings((state) => state.winkGestures);
  const onEyes = useWinkGestures((eye) => {
    const action = eye === 'right' ? gestures.rightEye : gestures.leftEye;
    if (action !== 'none') onAction(action);
  });
  const anyAction = gestures.rightEye !== 'none' || gestures.leftEye !== 'none';
  return gestures.enabled && anyAction ? onEyes : null;
}

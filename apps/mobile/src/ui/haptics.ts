import * as Haptics from 'expo-haptics';

import { useSettings } from '../features/settings/settings-store';

/**
 * Light taps that make the UI feel physical. All of them follow the vibration
 * setting (03 §9: vibration can be turned off).
 */
export const haptics = {
  /** Choosing something: a chip, a film, a tab. */
  select(): void {
    if (useSettings.getState().shutterFeedback) void Haptics.selectionAsync();
  },
  /** A firm press: the shutter, saving. */
  press(): void {
    if (useSettings.getState().shutterFeedback)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  /** Something worked: saved, purchased. */
  success(): void {
    if (useSettings.getState().shutterFeedback)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
};

import { appStateListeners } from '../controls';

/** The parts of `react-native` that non-UI modules use; tests drive it through `controls`. */
export const Platform = { OS: 'ios' as 'ios' | 'android' };

export const AppState = {
  addEventListener(_type: 'change', listener: (state: string) => void) {
    appStateListeners.add(listener);
    return {
      remove: () => {
        appStateListeners.delete(listener);
      },
    };
  },
};

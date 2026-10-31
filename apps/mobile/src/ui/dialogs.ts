import { Alert } from 'react-native';

import { strings } from '../i18n';

/** Asks before a destructive action; resolves to whether the user confirmed. */
export function confirmDestructive(
  message: string,
  confirmLabel: string = strings.common.delete,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(message, undefined, [
      {
        text: strings.common.cancel,
        style: 'cancel',
        onPress: () => {
          resolve(false);
        },
      },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: () => {
          resolve(true);
        },
      },
    ]);
  });
}

export function showError(message: string = strings.common.errorMessage): void {
  Alert.alert(strings.common.errorTitle, message);
}

/** A plain message, e.g. a confirmation that something worked. */
export function showMessage(message: string): void {
  Alert.alert(message);
}

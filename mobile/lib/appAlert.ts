import type { AlertButton, AlertTone } from '@/contexts/AlertContext';

type AlertHandler = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  tone?: AlertTone,
) => void;

let alertHandler: AlertHandler | null = null;

export function registerAppAlert(handler: AlertHandler) {
  alertHandler = handler;
}

/** Drop-in themed replacement for React Native Alert.alert. */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  tone?: AlertTone,
) {
  if (alertHandler) {
    alertHandler(title, message, buttons, tone);
    return;
  }

  // Fallback for early boot / tests
  const { Alert } = require('react-native') as typeof import('react-native');
  Alert.alert(title, message, buttons);
}

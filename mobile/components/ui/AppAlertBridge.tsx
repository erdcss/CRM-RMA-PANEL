import { useEffect } from 'react';

import { useAppAlert } from '@/contexts/AlertContext';
import { registerAppAlert } from '@/lib/appAlert';

export function AppAlertBridge() {
  const { showAlert } = useAppAlert();

  useEffect(() => {
    registerAppAlert(showAlert);
  }, [showAlert]);

  return null;
}

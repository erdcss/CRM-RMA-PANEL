import { useEffect, useState } from 'react';

export type MobileBranding = {
  b2b_mobile_logo?: string | null;
  b2b_mobile_splash?: string | null;
  business_mobile_logo?: string | null;
  business_mobile_splash?: string | null;
};

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export function useMobileBranding() {
  const [branding, setBranding] = useState<MobileBranding>({});

  useEffect(() => {
    if (!API_URL) return;
    let active = true;
    fetch(`${API_URL}/api/public/branding`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((payload) => {
        if (active) setBranding(payload as MobileBranding);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return branding;
}

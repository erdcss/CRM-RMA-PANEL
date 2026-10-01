import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type MobileBranding = {
  business_mobile_logo?: string | null;
  business_mobile_splash?: string | null;
};

type MobileBrandingResponse = {
  logo?: string | null;
  splash?: string | null;
};

const PRODUCTION_API_URL = 'https://admin.ecalisgan.com';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/$/, '');

async function fetchBusinessBranding(): Promise<MobileBranding> {
  const response = await fetch(
    `${API_URL}/api/public/mobile-branding/business?t=${Date.now()}`,
    {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Mobil marka bilgisi alınamadı (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as MobileBrandingResponse;

  return {
    business_mobile_logo: payload.logo || null,
    business_mobile_splash: payload.splash || null,
  };
}

export function useMobileBranding() {
  const [branding, setBranding] = useState<MobileBranding>({});

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const next = await fetchBusinessBranding();
        if (active) setBranding(next);
      } catch {
        if (active) {
          retryTimer = setTimeout(() => {
            void load();
          }, 1500);
        }
      }
    };

    void load();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void load();
      }
    });

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      subscription.remove();
    };
  }, []);

  return branding;
}

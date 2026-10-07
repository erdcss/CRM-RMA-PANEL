import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type MobileBranding = {
  b2b_mobile_logo?: string | null;
  b2b_mobile_splash?: string | null;
  business_mobile_logo?: string | null;
  business_mobile_splash?: string | null;
  loaded?: boolean;
};

type MobileBrandingResponse = {
  logo?: string | null;
  splash?: string | null;
  updatedAt?: number | null;
};

type PublicBrandingResponse = {
  b2b_logo?: string | null;
  b2b_mobile_logo?: string | null;
  b2b_mobile_splash?: string | null;
};

const PRODUCTION_API_URL = 'https://admin.ecalisgan.com';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/$/, '');

async function fetchB2BBranding(): Promise<MobileBranding> {
  const cacheBust = Date.now();
  const headers = {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  };

  const [mobileResponse, publicResponse] = await Promise.all([
    fetch(`${API_URL}/api/public/mobile-branding/b2b?t=${cacheBust}`, { headers }),
    fetch(`${API_URL}/api/public/branding?t=${cacheBust}`, { headers }),
  ]);

  if (!mobileResponse.ok && !publicResponse.ok) {
    throw new Error(
      `Mobil marka bilgisi alınamadı (HTTP ${mobileResponse.status}/${publicResponse.status})`,
    );
  }

  const mobile = mobileResponse.ok
    ? ((await mobileResponse.json()) as MobileBrandingResponse)
    : {};
  const branding = publicResponse.ok
    ? ((await publicResponse.json()) as PublicBrandingResponse)
    : {};

  return {
    // Uygulama içinde ana B2B logosu her zaman güncel marka logosunu takip eder.
    // Mobil özel logo ancak ana logo yoksa yedek olarak kullanılır.
    b2b_mobile_logo:
      branding.b2b_logo ||
      branding.b2b_mobile_logo ||
      mobile.logo ||
      null,
    b2b_mobile_splash:
      branding.b2b_mobile_splash ||
      mobile.splash ||
      branding.b2b_logo ||
      mobile.logo ||
      null,
    loaded: true,
  };
}

export function useMobileBranding() {
  const [branding, setBranding] = useState<MobileBranding>({ loaded: false });

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const next = await fetchB2BBranding();
        if (active) setBranding(next);
      } catch {
        if (active) {
          setBranding((current) => ({ ...current, loaded: true }));
          retryTimer = setTimeout(() => {
            void load();
          }, 1800);
        }
      }
    };

    void load();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      subscription.remove();
    };
  }, []);

  return branding;
}

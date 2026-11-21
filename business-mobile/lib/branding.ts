import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type MobileBranding = {
  business_mobile_logo?: string | null;
  business_mobile_splash?: string | null;
  updatedAt?: number | null;
  loaded?: boolean;
};

type MobileBrandingResponse = {
  logo?: string | null;
  splash?: string | null;
  updatedAt?: number | null;
};

const PRODUCTION_API_URL = 'https://admin.ecalisgan.com';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 6500;
const MAX_RETRIES = 3;

async function fetchBusinessBranding(signal: AbortSignal): Promise<MobileBranding> {
  const response = await fetch(
    `${API_URL}/api/public/mobile-branding/business?t=${Date.now()}`,
    {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`Mobil marka bilgisi alınamadı (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as MobileBrandingResponse;
  const logo = typeof payload.logo === 'string' && payload.logo ? payload.logo : null;
  const splash = typeof payload.splash === 'string' && payload.splash ? payload.splash : logo;

  return {
    business_mobile_logo: logo,
    business_mobile_splash: splash,
    updatedAt: payload.updatedAt || Date.now(),
    loaded: true,
  };
}

/**
 * Branding must never block app launch or retry forever when the API is offline.
 * Keep the last successful image, limit in-flight requests to one and retry
 * transient failures at most three times. Foregrounding the app allows another
 * attempt without keeping a permanent background polling loop.
 */
export function useMobileBranding() {
  const [branding, setBranding] = useState<MobileBranding>({ loaded: false });

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const load = async () => {
      if (!active || inFlight) return;
      inFlight = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }

      const requestController = new AbortController();
      controller = requestController;
      const timeout = setTimeout(() => requestController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const next = await fetchBusinessBranding(requestController.signal);
        if (!active) return;
        retryCount = 0;
        setBranding(next);
      } catch {
        if (!active) return;

        // Offline branding must not hide the app or discard previously loaded art.
        setBranding((current) => ({ ...current, loaded: true }));

        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(8000, 2000 * 2 ** retryCount);
          retryCount += 1;
          retryTimer = setTimeout(() => {
            retryTimer = null;
            void load();
          }, delay);
        }
      } finally {
        clearTimeout(timeout);
        if (controller === requestController) controller = null;
        inFlight = false;
      }
    };

    void load();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        retryCount = 0;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        void load();
      }
    });

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
      subscription.remove();
    };
  }, []);

  return branding;
}

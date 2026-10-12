import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type MobileBranding = {
  b2b_web_logo?: string | null;
  b2b_mobile_logo?: string | null;
  b2b_mobile_splash?: string | null;
  b2b_mobile_login_background?: string | null;
  business_mobile_logo?: string | null;
  business_mobile_splash?: string | null;
  loaded?: boolean;
};

type MobileBrandingResponse = {
  logo?: string | null;
  webLogo?: string | null;
  splash?: string | null;
  loginBackground?: string | null;
  updatedAt?: number | null;
};

const PRODUCTION_API_URL = 'https://b2b.ecalisgan.com';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/$/, '');
const BRANDING_TTL_MS = 60_000;
const RETRY_MS = 15_000;

// All screens share the same image URLs and the same network request.
let cachedBranding: MobileBranding = { loaded: false };
let lastSuccess = 0;
let lastAttempt = 0;
let pending: Promise<void> | null = null;
let appSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(next: MobileBranding) => void>();

function publish(next: MobileBranding) {
  cachedBranding = next;
  listeners.forEach((listener) => listener(next));
}

function normalizeBrandAsset(value?: string | null) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) return null;
  if (clean.startsWith('data:image/') || clean.startsWith('https://') || clean.startsWith('http://')) {
    return clean;
  }
  return `${API_URL}/${clean.replace(/^\//, '')}`;
}

async function fetchB2BBranding(): Promise<MobileBranding> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(
      `${API_URL}/api/public/mobile-branding/b2b?t=${Date.now()}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`Mobil marka bilgisi alınamadı: ${response.status}`);
    const branding = (await response.json()) as MobileBrandingResponse;
    const logo = normalizeBrandAsset(branding.logo);
    return {
      // The app uses only the mobile assets configured in Admin settings.
      b2b_web_logo: logo,
      b2b_mobile_logo: logo,
      b2b_mobile_splash: normalizeBrandAsset(branding.splash),
      b2b_mobile_login_background: normalizeBrandAsset(branding.loginBackground),
      loaded: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function refreshBranding(): Promise<void> {
  if (pending) return pending;
  const now = Date.now();
  if (lastSuccess && now - lastSuccess < BRANDING_TTL_MS) return Promise.resolve();
  if (lastAttempt && now - lastAttempt < RETRY_MS) return Promise.resolve();

  lastAttempt = now;
  pending = fetchB2BBranding()
    .then((branding) => {
      lastSuccess = Date.now();
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      publish(branding);
    })
    .catch(() => {
      if (!cachedBranding.loaded) publish({ ...cachedBranding, loaded: true });
      if (!retryTimer && listeners.size > 0) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (AppState.currentState === 'active') void refreshBranding();
        }, RETRY_MS + 1000);
      }
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function useMobileBranding() {
  const [branding, setBranding] = useState<MobileBranding>(() => cachedBranding);

  useEffect(() => {
    listeners.add(setBranding);
    setBranding(cachedBranding);

    if (!appSubscription) {
      appSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refreshBranding();
      });
    }
    void refreshBranding();

    return () => {
      listeners.delete(setBranding);
      if (listeners.size === 0) {
        appSubscription?.remove();
        appSubscription = null;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = null;
      }
    };
  }, []);

  return branding;
}

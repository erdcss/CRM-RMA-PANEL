import { useQuery } from "@tanstack/react-query";

export type BrandingConfig = {
  admin_logo?: string | null;
  admin_favicon?: string | null;
  b2b_logo?: string | null;
  b2b_favicon?: string | null;
  b2b_mobile_logo?: string | null;
  b2b_mobile_splash?: string | null;
  business_mobile_logo?: string | null;
  business_mobile_splash?: string | null;
};

async function fetchBranding(): Promise<BrandingConfig> {
  const response = await fetch("/api/public/branding", { credentials: "include" });
  if (!response.ok) return {};
  return response.json();
}

export function useBranding() {
  return useQuery<BrandingConfig>({
    queryKey: ["/api/public/branding"],
    queryFn: fetchBranding,
    staleTime: 60_000,
  });
}

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.EXPO_PUBLIC_SUPABASE_KEY ??
  "";

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase ortam değişkenleri eksik. Kök dizindeki .env dosyasında EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_KEY tanımlayın.",
  );
}

export const supabase = createClient(supabaseUrl || "https://invalid.local", supabaseKey || "missing-key", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export async function getOwnerUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const userId = await getOwnerUserId();
  if (!userId) return {};
  return { "X-Owner-User-Id": userId };
}

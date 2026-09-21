import type { Express, Request } from "express";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "app-branding";
const APPS = ["b2b", "business"] as const;
const KINDS = ["logo", "splash"] as const;

function getBearerToken(req: Request) {
  const authorization = req.header("Authorization");
  if (!authorization) return undefined;
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token?.trim() ? token.trim() : undefined;
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase server credentials are not configured");
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function requireAdmin(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;
  const supabase = getAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const role = user.app_metadata?.app_role;
  if (role && !["super_admin", "admin"].includes(role)) return null;
  return { supabase, user };
}

async function ensureBucket(supabase: ReturnType<typeof getAdminClient>) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  });
  if (error && !error.message.toLowerCase().includes("already")) throw error;
}

function isApp(value: unknown): value is (typeof APPS)[number] {
  return typeof value === "string" && APPS.includes(value as (typeof APPS)[number]);
}

function isKind(value: unknown): value is (typeof KINDS)[number] {
  return typeof value === "string" && KINDS.includes(value as (typeof KINDS)[number]);
}

export function registerBrandingRoutes(app: Express): void {
  app.get("/api/admin/app-branding", async (req, res) => {
    try {
      const auth = await requireAdmin(req);
      if (!auth) return res.status(403).json({ error: "Yönetici yetkisi gerekiyor" });
      await ensureBucket(auth.supabase);

      const result: Record<string, { logo: string | null; splash: string | null }> = {
        b2b: { logo: null, splash: null },
        business: { logo: null, splash: null },
      };

      for (const appName of APPS) {
        const { data, error } = await auth.supabase.storage.from(BUCKET).list(appName, { limit: 20 });
        if (error) throw error;
        for (const file of data ?? []) {
          const kind = KINDS.find((candidate) => file.name.startsWith(candidate + "."));
          if (!kind) continue;
          const path = `${appName}/${file.name}`;
          const { data: publicData } = auth.supabase.storage.from(BUCKET).getPublicUrl(path);
          result[appName][kind] = `${publicData.publicUrl}?v=${encodeURIComponent(file.updated_at ?? file.created_at ?? "")}`;
        }
      }

      return res.json(result);
    } catch (error) {
      console.error("Failed to load app branding:", error);
      return res.status(500).json({ error: "Uygulama görselleri alınamadı" });
    }
  });

  app.post("/api/admin/app-branding", async (req, res) => {
    try {
      const auth = await requireAdmin(req);
      if (!auth) return res.status(403).json({ error: "Yönetici yetkisi gerekiyor" });

      const { app: appName, kind, dataUrl } = req.body ?? {};
      if (!isApp(appName) || !isKind(kind) || typeof dataUrl !== "string") {
        return res.status(400).json({ error: "Geçersiz uygulama veya görsel türü" });
      }

      const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return res.status(400).json({ error: "PNG, JPG veya WEBP görsel yükleyin" });

      const mime = match[1];
      const buffer = Buffer.from(match[2], "base64");
      if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Görsel boyutu en fazla 5 MB olabilir" });
      }

      await ensureBucket(auth.supabase);
      const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
      const folder = appName;
      const { data: existing } = await auth.supabase.storage.from(BUCKET).list(folder, { limit: 20 });
      const stale = (existing ?? []).filter((file) => file.name.startsWith(kind + ".")).map((file) => `${folder}/${file.name}`);
      if (stale.length) await auth.supabase.storage.from(BUCKET).remove(stale);

      const path = `${folder}/${kind}.${ext}`;
      const { error } = await auth.supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType: mime,
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw error;

      const { data } = auth.supabase.storage.from(BUCKET).getPublicUrl(path);
      return res.json({ app: appName, kind, url: `${data.publicUrl}?v=${Date.now()}` });
    } catch (error) {
      console.error("Failed to save app branding:", error);
      return res.status(500).json({ error: "Görsel kaydedilemedi" });
    }
  });
}

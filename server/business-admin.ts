import type { Express, Request } from "express";
import { createClient } from "@supabase/supabase-js";

function getBearerToken(req: Request): string | undefined {
  const authorization = req.header("Authorization");
  if (!authorization) return undefined;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) return undefined;
  return token.trim();
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase server credentials are not configured");
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function requirePlatformAdmin(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;
  const supabase = getAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  // Bootstrap rule: current web accounts remain usable while the dedicated role
  // system is introduced. Once an admin has app_role metadata, only admin roles pass.
  const role = user.app_metadata?.app_role || user.user_metadata?.app_role;
  if (role && !["super_admin", "admin"].includes(role)) return null;
  return { user, supabase };
}

export function registerBusinessAdminRoutes(app: Express): void {
  app.get("/api/admin/business-users", async (req, res) => {
    try {
      const auth = await requirePlatformAdmin(req);
      if (!auth) return res.status(403).json({ error: "Yönetici yetkisi gerekiyor" });

      const { data, error } = await auth.supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;

      const users = data.users
        .filter((user) => user.app_metadata?.app_access === "business")
        .map((user) => ({
          id: user.id,
          email: user.email,
          role: user.app_metadata?.app_role || "manager",
          appAccess: user.app_metadata?.app_access || null,
          isActive: user.banned_until ? false : true,
          createdAt: user.created_at,
        }));

      res.json(users);
    } catch (error) {
      console.error("Failed to list Business users:", error);
      res.status(500).json({ error: "Yönetici hesapları alınamadı" });
    }
  });

  app.post("/api/admin/business-users", async (req, res) => {
    try {
      const auth = await requirePlatformAdmin(req);
      if (!auth) return res.status(403).json({ error: "Yönetici yetkisi gerekiyor" });

      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || password.length < 8) {
        return res.status(400).json({ error: "Geçerli e-posta ve en az 8 karakter şifre gerekli" });
      }

      const { data, error } = await auth.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          app_role: "manager",
          app_access: "business",
        },
        user_metadata: {
          assigned_from: "caliskan_web_admin",
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already")) {
          return res.status(409).json({ error: "Bu e-posta zaten kayıtlı" });
        }
        throw error;
      }

      res.status(201).json({
        id: data.user.id,
        email: data.user.email,
        role: "manager",
        appAccess: "business",
        isActive: true,
      });
    } catch (error) {
      console.error("Failed to create Business user:", error);
      res.status(500).json({ error: "Yönetici hesabı oluşturulamadı" });
    }
  });

  app.patch("/api/admin/business-users/:id", async (req, res) => {
    try {
      const auth = await requirePlatformAdmin(req);
      if (!auth) return res.status(403).json({ error: "Yönetici yetkisi gerekiyor" });

      const enabled = req.body?.isActive !== false;
      const { data, error } = await auth.supabase.auth.admin.updateUserById(req.params.id, {
        ban_duration: enabled ? "none" : "876000h",
        app_metadata: {
          app_role: "manager",
          app_access: "business",
        },
      });
      if (error) throw error;

      res.json({
        id: data.user.id,
        email: data.user.email,
        role: data.user.app_metadata?.app_role || "manager",
        appAccess: data.user.app_metadata?.app_access || "business",
        isActive: enabled,
      });
    } catch (error) {
      console.error("Failed to update Business user:", error);
      res.status(500).json({ error: "Yönetici hesabı güncellenemedi" });
    }
  });
}

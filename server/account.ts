import type { Express, Request } from "express";
import { createClient } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";

import { db } from "./db";
import {
  catalogCustomers,
  catalogProducts,
  customers,
  supplierItems,
  tickets,
} from "@shared/schema";

function getBearerToken(req: Request): string | undefined {
  const authorization = req.header("Authorization");
  if (!authorization) return undefined;

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) return undefined;
  return token.trim();
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Supabase server credentials are not configured");
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function registerAccountRoutes(app: Express): void {
  app.delete("/api/account", async (req, res) => {
    try {
      const accessToken = getBearerToken(req);
      if (!accessToken) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const supabase = getSupabaseAdmin();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(accessToken);

      if (authError || !user) {
        return res.status(401).json({ error: "Invalid or expired session" });
      }

      // Never trust a client supplied user id for destructive operations.
      // If the legacy owner header is present, it must match the authenticated user.
      const ownerHeader = req.header("X-Owner-User-Id")?.trim();
      if (ownerHeader && ownerHeader !== user.id) {
        return res.status(403).json({ error: "Account ownership mismatch" });
      }

      // Remove all rows that are explicitly owned by this Supabase user.
      // Deleting tickets cascades to products, status_history and supplier_items.
      await db.delete(catalogProducts).where(eq(catalogProducts.ownerUserId, user.id));
      await db.delete(catalogCustomers).where(eq(catalogCustomers.ownerUserId, user.id));
      await db.delete(supplierItems).where(eq(supplierItems.ownerUserId, user.id));
      await db.delete(tickets).where(eq(tickets.ownerUserId, user.id));

      // Customer rows are shared by the legacy schema, so only remove customers
      // that are no longer referenced by any ticket after the user's tickets are gone.
      await db.execute(sql`
        DELETE FROM ${customers}
        WHERE NOT EXISTS (
          SELECT 1 FROM ${tickets}
          WHERE ${tickets.customerId} = ${customers.id}
        )
      `);

      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteUserError) {
        console.error("Failed to delete Supabase auth user:", deleteUserError.message);
        return res.status(500).json({
          error: "Account data was removed but the authentication account could not be deleted. Please retry.",
        });
      }

      return res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting account:", error);
      return res.status(500).json({ error: "Failed to delete account" });
    }
  });
}

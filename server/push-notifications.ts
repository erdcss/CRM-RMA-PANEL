import { pool } from "./db";

type PushApp = "business" | "b2b";

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | 'b2b-custom.wav';
};

export async function ensureMobilePushTable() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mobile_push_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      app TEXT NOT NULL,
      expo_token TEXT NOT NULL UNIQUE,
      platform TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      session_active BOOLEAN,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE mobile_push_tokens
      ADD COLUMN IF NOT EXISTS session_active BOOLEAN;
    CREATE INDEX IF NOT EXISTS mobile_push_tokens_app_idx
      ON mobile_push_tokens(app, active);
    CREATE INDEX IF NOT EXISTS mobile_push_tokens_user_idx
      ON mobile_push_tokens(user_id, active);
  `);
}

export async function registerMobilePushToken(input: {
  userId: number;
  app: PushApp;
  expoToken: string;
  platform?: string;
}) {
  if (!pool) throw new Error("Veritabanı bağlantısı yok");
  const token = String(input.expoToken || "").trim();
  if (!/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token)) {
    throw new Error("Geçersiz Expo push token");
  }

  await pool.query(
    `INSERT INTO mobile_push_tokens (user_id, app, expo_token, platform, active, session_active, updated_at)
     VALUES ($1,$2,$3,$4,TRUE,TRUE,NOW())
     ON CONFLICT (expo_token)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       app = EXCLUDED.app,
       platform = EXCLUDED.platform,
       active = TRUE,
       session_active = TRUE,
       updated_at = NOW()`,
    [input.userId, input.app, token, input.platform || null],
  );

  return { ok: true };
}

/** Logging out preserves the device's permission and account association for
 * optional promotional campaigns, but blocks ordinary private/account pushes. */
export async function markB2BPushSession(userId:number,expoToken:string,sessionActive:boolean){
  if(!pool)return false;
  const token=String(expoToken||'').trim();
  if(!/^(?:ExponentPushToken|ExpoPushToken)\\[[^\\]]+\\]$/.test(token))return false;
  const result=await pool.query(`UPDATE mobile_push_tokens
    SET session_active=$3,updated_at=NOW()
    WHERE app='b2b' AND user_id=$1 AND expo_token=$2 AND active=TRUE`,
    [userId,token,sessionActive]);
  return (result.rowCount||0)>0;
}

export async function disableMobilePushToken(expoToken: string) {
  if (!pool) return;
  await pool.query(
    `UPDATE mobile_push_tokens
     SET active = FALSE, updated_at = NOW()
     WHERE expo_token = $1`,
    [expoToken],
  ).catch(() => undefined);
}

async function sendExpoMessages(tokens: string[], payload: PushPayload) {
  if (!tokens.length) return { sent: 0 };

  let sent = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    const messages = chunk.map((to) => ({
      to,
      sound: payload.sound || "default",
      channelId: payload.sound === "b2b-custom.wav" ? "b2b-custom" : "default",
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      priority: "high",
    }));

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error("Expo push HTTP error", response.status, await response.text().catch(() => ""));
        continue;
      }

      const result = await response.json() as { data?: Array<any> };
      const tickets = Array.isArray(result?.data) ? result.data : [];

      for (let index = 0; index < tickets.length; index += 1) {
        const ticket = tickets[index];
        const token = chunk[index];
        if (ticket?.status === "ok") {
          sent += 1;
          continue;
        }
        if (ticket?.details?.error === "DeviceNotRegistered" && token) {
          await disableMobilePushToken(token);
        }
      }
    } catch (error) {
      console.error("Expo push send failed:", error instanceof Error ? error.message : error);
    }
  }

  return { sent };
}

export async function sendPushToApp(app: PushApp, payload: PushPayload) {
  if (!pool) return { sent: 0 };

  const result = await pool.query(
    `SELECT expo_token
     FROM mobile_push_tokens
     WHERE app = $1 AND active = TRUE
     ORDER BY updated_at DESC`,
    [app],
  );

  const tokens = result.rows
    .map((row) => String(row.expo_token || "").trim())
    .filter(Boolean);

  return sendExpoMessages(tokens, payload);
}

/** Business app pushes are always routed to authenticated recipient accounts.
 * Never broadcast order/customer information to every installed Business app.
 */
export async function sendBusinessPushToUsers(userIds:number[],payload:PushPayload) {
  if (!pool || !userIds.length) return {sent:0,tokenCount:0};
  const ids=[...new Set(userIds.filter(id=>Number.isSafeInteger(id)&&id>0))];
  if(!ids.length)return {sent:0,tokenCount:0};
  const response=await pool.query(`SELECT t.expo_token FROM mobile_push_tokens t
    JOIN users u ON u.id=t.user_id
    WHERE t.app='business' AND t.active=TRUE AND t.user_id=ANY($1::int[]) AND u.is_active=1`,[ids]);
  const tokens=response.rows.map(row=>String(row.expo_token||"")).filter(Boolean);
  return {...await sendExpoMessages(tokens,payload),tokenCount:tokens.length};
}
export async function sendBusinessPushToSuperAdmins(payload:PushPayload){
  if(!pool)return {sent:0,tokenCount:0};
  const admins=await pool.query("SELECT id FROM users WHERE role='super_admin' AND is_active=1");
  return sendBusinessPushToUsers(admins.rows.map(row=>Number(row.id)),payload);
}

/** Only deliver customer messages to the explicitly selected account(s).
 * Expo acceptance is not the same as a device delivery receipt.
 */
export async function sendPushToUsers(userIds: number[], payload: PushPayload, options: { includeLoggedOut?: boolean } = {}) {
  if (!pool || !userIds.length) return { sent: 0, tokenCount: 0 };
  const ids = [...new Set(userIds.filter(id => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length) return { sent: 0, tokenCount: 0 };
  const result = await pool.query(
    `SELECT expo_token FROM mobile_push_tokens
     WHERE app='b2b' AND active=TRUE AND user_id=ANY($1::int[])
       AND ($2::boolean OR session_active IS DISTINCT FROM FALSE)`,
    [ids, options.includeLoggedOut === true],
  );
  const tokens = result.rows.map(row => String(row.expo_token || "")).filter(Boolean);
  const outcome = await sendExpoMessages(tokens, payload);
  return { ...outcome, tokenCount: tokens.length };
}

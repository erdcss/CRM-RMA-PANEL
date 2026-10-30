import {trackMetaEvent} from "./meta-pixel";

function getVisitorId(): string {
  const key = "caliskan_b2b_visitor_id";
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

async function post(path: string, body: Record<string, unknown>) {
  try {
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(body),
    });
  } catch {
    // Analytics must never block the storefront.
  }
}

export function trackSession() {
  if (typeof window === "undefined") return;
  return post("/api/analytics/session", { visitorId: getVisitorId() });
}

export function trackSearch(query: string) {
  if (typeof window === "undefined") return;
  const clean = query.trim();
  if (clean.length < 2) return;
  // Never send possible email addresses or phone numbers to advertising partners.
  if(!/[@]|[0-9]{8,}/.test(clean))trackMetaEvent("Search",{search_string:clean.slice(0,100)});
  return post("/api/analytics/search", { visitorId: getVisitorId(), query: clean });
}

export function trackProductView(productId: string | number, name?: string | null, price?: number | null) {
  if (typeof window === "undefined") return;
  const value=Number(price);
  trackMetaEvent("ViewContent",{
    content_ids:[String(productId)],content_type:"product",
    content_name:String(name||"").slice(0,120),
    currency:"TRY",
    ...(Number.isFinite(value)&&value>0?{value}:{}),
  });
  return post("/api/analytics/product-view", {
    visitorId: getVisitorId(),
    productId,
    name: name || "",
  });
}


/** Authenticated, first-party customer engagement; independent from advertising pixels. */
function usageEvent(body: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  return post("/api/b2b/usage-event", {
    sessionId: getVisitorId(), platform: "web", ...body,
  });
}

export function trackCustomerUsageSession() {
  if (typeof document !== "undefined" && !document.hidden) {
    void usageEvent({ type: "session" });
  }
}

export function trackCustomerProductVisit(id: string | number, name: string | null | undefined) {
  return usageEvent({ type: "product_view", productId: String(id), productName: name || "" });
}

export function trackCustomerProductDuration(id: string | number, name: string | null | undefined, seconds: number) {
  const duration = Math.min(300, Math.max(0, Math.round(seconds)));
  if (duration < 1) return;
  return usageEvent({
    type: "product_duration", productId: String(id), productName: name || "",
    seconds: duration,
  });
}

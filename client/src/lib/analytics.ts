function getVisitorId(): string {
  const key = "caliskan_b2b_visitor_id";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, id);
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
  return post("/api/analytics/search", { visitorId: getVisitorId(), query: clean });
}

export function trackProductView(productId: string | number, name?: string | null) {
  if (typeof window === "undefined") return;
  return post("/api/analytics/product-view", {
    visitorId: getVisitorId(),
    productId,
    name: name || "",
  });
}

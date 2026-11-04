export type B2BBottomTab = "home" | "categories" | "orders" | "account";

const normalizedPath = (value: string) => {
  const path = (value || "/").split("?")[0].replace(/\/+$/, "");
  return path || "/";
};

/** Keep the highlighted tab consistent, including protected-account login. */
export function b2bBottomActiveTab(location: string, search = ""): B2BBottomTab | null {
  const path = normalizedPath(location);
  const inlineSearch = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  const query = new URLSearchParams(search || inlineSearch);
  if (path === "/uye-girisi" || path === "/login") {
    if (query.get("from") === "hesabim") return "account";
    if (query.get("from") === "siparislerim") return "orders";
    return null;
  }
  if (path === "/") return "home";
  if (path === "/kategoriler" || path.startsWith("/kategori/")) return "categories";
  if (path === "/siparislerim" || path === "/pazaryeri-sepetim" || path === "/odeme" || path.startsWith("/odeme/")) return "orders";
  if (path === "/hesabim" || path.startsWith("/hesabim/")) return "account";
  if (path.startsWith("/urun/") || path.startsWith("/magaza/")) return "home";
  return null;
}

/** Never redirect to an arbitrary URL supplied in a query parameter. */
export function b2bDestinationAfterLogin(search = ""): string {
  const from = new URLSearchParams(search).get("from");
  if (from === "hesabim") return "/hesabim";
  if (from === "siparislerim") return "/siparislerim";
  return "/";
}

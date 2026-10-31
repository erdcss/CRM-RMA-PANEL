export type SellerAccessMode = "home" | "login" | "register";

/** Restore the intended form on direct links, browser refresh, and Back/Forward. */
export function sellerAccessModeFromPath(path: string): SellerAccessMode {
  if (path === "/auth/login" || path === "/auth/login/") return "login";
  if (path === "/auth/register" || path === "/auth/register/") return "register";
  return "home";
}

export function sellerAccessPath(mode: SellerAccessMode): string {
  return mode === "login" ? "/auth/login" : mode === "register" ? "/auth/register" : "/";
}

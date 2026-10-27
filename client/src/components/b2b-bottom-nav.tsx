import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Grid2X2, House, ShoppingCart, UserRound } from "lucide-react";
import { useB2BCart } from "@/lib/b2b-cart";

type TabKey = "home" | "categories" | "orders" | "account";
type SessionUser = { role?: string; isActive?: boolean } | null;

async function loadSession(): Promise<SessionUser> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
}

const tabs = [
  { key: "home" as const, label: "Ana Sayfa", href: "/", icon: House },
  { key: "categories" as const, label: "Kategoriler", href: "/kategoriler", icon: Grid2X2 },
  { key: "orders" as const, label: "Siparişlerim", href: "/siparislerim", icon: ShoppingCart },
  { key: "account" as const, label: "Hesabım", href: "/hesabim", icon: UserRound },
];

function activeTab(path: string): TabKey | null {
  if (path === "/") return "home";
  if (path === "/kategoriler" || path.startsWith("/kategori/")) return "categories";
  if (path === "/siparislerim" || path === "/pazaryeri-sepetim" || path === "/odeme") return "orders";
  if (path === "/hesabim") return "account";
  if (path.startsWith("/urun/") || path.startsWith("/magaza/")) return "home";
  return null;
}

/**
 * The 4 native-app B2B tabs adapted to mobile web and desktop.
 * Background, active yellow capsule, compact icons, rounded glass-like
 * iOS bar, and badges mirror mobile/components/navigation/TabBar.tsx.
 */
export function B2BBottomNav() {
  const [location] = useLocation();
  const reduceMotion = useReducedMotion();
  const current = activeTab(location);
  const { itemCount } = useB2BCart();
  const { data: session } = useQuery<SessionUser>({
    queryKey: ["/api/auth/me"],
    queryFn: loadSession,
    retry: false,
    staleTime: 15_000,
  });
  const isCustomer = session?.role === "b2b_customer" && session.isActive === true;

  return (
    <nav aria-label="Çalışkan B2B alt navigasyon"
      className="pointer-events-none fixed inset-x-0 z-[65] flex justify-center px-3 md:px-6"
      style={{ bottom: "max(10px, env(safe-area-inset-bottom, 0px))" }}>
      <LayoutGroup id="caliskan-b2b-nav">
      <div className="pointer-events-auto grid min-h-[70px] w-full max-w-[660px] grid-cols-4 items-stretch rounded-[24px] border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/85 md:min-h-[78px] md:p-2">
        {tabs.map(({ key, label, href, icon: Icon }) => {
          const selected = current === key;
          const destination = (key === "orders" || key === "account") && session !== undefined && !isCustomer
            ? "/uye-girisi"
            : href;
          return (
            <Link key={key} href={destination}
              aria-current={selected ? "page" : undefined}
              aria-label={label + (key === "orders" && itemCount > 0 ? `, ${itemCount} ürün` : "")}
              onClick={() => {
                const scroller = document.querySelector<HTMLElement>(".b2b-site");
                if (scroller) scroller.scrollTo({ top: 0, behavior: "auto" });
                else window.scrollTo({ top: 0, behavior: "instant" });
              }}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[19px] px-0.5 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#eab308] ${selected ? "text-[#191919]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
              <motion.span
                className="relative flex h-[32px] min-w-[43px] items-center justify-center rounded-full"
                whileTap={reduceMotion ? undefined : { scale: 0.86 }}
                animate={reduceMotion ? undefined : { y: selected ? -2 : 0, scale: selected ? 1.04 : 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 27 }}>
                {selected ? (
                  <motion.span
                    layoutId="b2b-active-tab"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-[#FFF1A8]"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 470, damping: 35 }}
                  />
                ) : null}
                <Icon className="relative z-[1]" aria-hidden="true" size={21} strokeWidth={selected ? 2.5 : 1.8} />
                {key === "orders" && itemCount > 0 ? (
                  <motion.span
                    key={itemCount}
                    initial={reduceMotion ? false : { scale: 0.7 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 450, damping: 24 }}
                    aria-hidden="true"
                    className="absolute -right-2 -top-1.5 z-[2] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-[#E11D48] px-1 text-[10px] font-black leading-none text-white">
                    {itemCount > 9 ? "9+" : itemCount}
                  </motion.span>
                ) : null}
              </motion.span>
              <motion.span
                animate={reduceMotion ? undefined : { opacity: selected ? 1 : 0.72, y: selected ? -1 : 0 }}
                transition={{ duration: 0.18 }}
                className={`max-w-full truncate text-[10px] leading-[14px] md:text-xs ${selected ? "font-extrabold text-[#191919]" : "font-semibold text-slate-500"}`}>
                {label}
              </motion.span>
            </Link>
          );
        })}
      </div>
      </LayoutGroup>
    </nav>
  );
}

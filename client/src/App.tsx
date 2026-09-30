import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationCenter } from "@/components/notification-center";
import Dashboard from "@/pages/dashboard";
import Kayitlar from "@/pages/kayitlar";
import Istatistikler from "@/pages/istatistikler";
import Musteriler from "@/pages/musteriler";
import Ayarlar from "@/pages/ayarlar";
import Depolar from "@/pages/depolar";
import Tedarikciler from "@/pages/tedarikciler";
import Faturalar from "@/pages/faturalar";
import KayitDetay from "@/pages/kayit-detay";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Yoneticiler from "@/pages/yoneticiler";
import YapayZeka from "@/pages/yapay-zeka";
import AdminProductAdd from "@/pages/admin-product-add";
import AdminProducts from "@/pages/admin-products";
import AdminProductAiImport from "@/pages/admin-product-ai-import";
import AdminReturns from "@/pages/admin-returns";
import AdminStock from "@/pages/admin-stock";
import AdminOrders from "@/pages/admin-orders";
import AdminApplications from "@/pages/admin-applications";
import B2BStorefront from "@/pages/b2b-storefront";
import B2BProductPage from "@/pages/b2b-product";
import B2BLogin from "@/pages/b2b-login";
import B2BRegister from "@/pages/b2b-register";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBranding } from "@/hooks/use-branding";
import { trackSession } from "@/lib/analytics";

function isB2BHost() {
  const configuredMode = String((import.meta as any).env?.VITE_APP_MODE || "").toLowerCase();
  if (configuredMode === "b2b") return true;
  if (configuredMode === "admin") return false;
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "b2b.ecalisgan.com" ||
    hostname.startsWith("caliskan-b2b-web-") ||
    hostname.includes("caliskan-b2b-web")
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/kayitlar" component={Kayitlar} />
      <Route path="/kayit/:id" component={KayitDetay} />
      <Route path="/istatistikler" component={Istatistikler} />
      <Route path="/musteriler" component={Musteriler} />
      <Route path="/depolar" component={Depolar} />
      <Route path="/tedarikciler" component={Tedarikciler} />
      <Route path="/faturalar" component={Faturalar} />
      <Route path="/ayarlar" component={Ayarlar} />
      <Route path="/yoneticiler" component={Yoneticiler} />
      <Route path="/yapay-zeka" component={YapayZeka} />
      <Route path="/urunler" component={AdminProducts} />
      <Route path="/urunler/ekle" component={AdminProductAdd} />
      <Route path="/urunler/ai-aktar" component={AdminProductAiImport} />
      <Route path="/urun-ekle" component={AdminProductAdd} />
      <Route path="/iade-islemleri" component={AdminReturns} />
      <Route path="/stok-durumu" component={AdminStock} />
      <Route path="/siparisler" component={AdminOrders} />
      <Route path="/basvurular" component={AdminApplications} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { data: user, isLoading } = useQuery<{ id: number; username: string; role: string; appAccess: string; isActive: boolean } | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
    }
  }, []);

  return (
    <>
      {isLoading ? null : user && ["super_admin", "admin"].includes(user.role) ? (
          <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
            <div className="flex h-dvh max-h-dvh w-full overflow-hidden">
              <AppSidebar username={user.username} />
              <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <header className="flex items-center justify-between p-4 border-b shrink-0 pt-[max(1rem,env(safe-area-inset-top))]">
                  <SidebarTrigger className="md:hidden" data-testid="button-sidebar-toggle" />
                  <div className="flex items-center gap-2">
                    <NotificationCenter />
                    <ThemeToggle />
                  </div>
                </header>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Router />
                </div>
              </div>
            </div>
          </SidebarProvider>
        ) : (
          <Login />
        )}
      <Toaster />
    </>
  );
}

function B2BWebsite() {
  useEffect(() => {
    document.title = "Çalışkan B2B";
    void trackSession();
    const timer = window.setInterval(() => {
      void trackSession();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Switch>
      <Route path="/" component={B2BStorefront} />
      <Route path="/urun/:id" component={B2BProductPage} />
      <Route path="/uye-girisi" component={B2BLogin} />
      <Route path="/login" component={B2BLogin} />
      <Route path="/kayit-ol" component={B2BRegister} />
      <Route component={B2BStorefront} />
    </Switch>
  );
}

function BrandingRuntime() {
  const { data: branding } = useBranding();

  useEffect(() => {
    const isB2B = isB2BHost();
    const favicon = isB2B ? branding?.b2b_favicon : branding?.admin_favicon;
    if (!favicon) return;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = favicon;
  }, [branding?.admin_favicon, branding?.b2b_favicon]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrandingRuntime />
        {isB2BHost() ? <B2BWebsite /> : <AppContent />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

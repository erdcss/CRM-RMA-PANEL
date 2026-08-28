import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

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
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { data: user, isLoading } = useQuery<{ id: number; username: string } | null>({
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
      {isLoading ? null : user ? (
          <SidebarProvider defaultOpen={false} style={style as React.CSSProperties}>
            <div className="flex h-dvh max-h-dvh w-full overflow-hidden">
              <AppSidebar username={user.username} />
              <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <header className="flex items-center justify-between p-4 border-b shrink-0 pt-[max(1rem,env(safe-area-inset-top))]">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

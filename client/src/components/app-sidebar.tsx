import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Package,
  Truck,
  Receipt,
  Sparkles,
  RotateCcw,
  ChevronDown,
  PackagePlus,
  Undo2,
  Boxes,
  ShoppingCart,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link, useLocation } from "wouter";
import { BRAND } from "@/lib/brand";
import { apiRequest } from "@/lib/queryClient";
import { useBranding } from "@/hooks/use-branding";

const rmaItems = [
  { title: "Kayıtlar", url: "/kayitlar", icon: FileText },
  { title: "İstatistikler", url: "/istatistikler", icon: BarChart3 },
  { title: "Müşteriler", url: "/musteriler", icon: Users },
  { title: "Depolar", url: "/depolar", icon: Package },
  { title: "Tedarikçiler", url: "/tedarikciler", icon: Truck },
  { title: "Faturalar", url: "/faturalar", icon: Receipt },
];

const standaloneItems = [
  { title: "Ayarlar", url: "/ayarlar", icon: Settings },
  { title: "Yapay Zeka", url: "/yapay-zeka", icon: Sparkles },
];

const operationItems = [
  { title: "Ürün Ekle", url: "/urun-ekle", icon: PackagePlus },
  { title: "İade İşlemleri", url: "/iade-islemleri", icon: Undo2 },
  { title: "Stok Durumu", url: "/stok-durumu", icon: Boxes },
  { title: "Siparişler", url: "/siparisler", icon: ShoppingCart },
];

export function AppSidebar({ username }: { username: string }) {
  const [location] = useLocation();
  const { setOpenMobile } = useSidebar();
  const { data: branding } = useBranding();
  const rmaActive = rmaItems.some((item) => location === item.url || location.startsWith("/kayit/"));

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-3">
        <div className="flex items-center gap-2.5 px-1">
          <img
            src={branding?.admin_logo || BRAND.logo}
            alt={BRAND.name}
            width={38}
            height={38}
            className="h-10 w-10 rounded-lg border border-sidebar-border object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight leading-tight">{BRAND.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">Yönetim Merkezi</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"}>
                  <Link href="/" onClick={() => setOpenMobile(false)}>
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Collapsible defaultOpen={rmaActive}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={rmaActive} className="w-full">
                      <RotateCcw className="h-4 w-4" />
                      <span>RMA</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-1 space-y-1 border-l pl-3">
                      {rmaItems.map((item) => {
                        const active = location === item.url || (item.url === "/kayitlar" && location.startsWith("/kayit/"));
                        return (
                          <SidebarMenuButton key={item.title} asChild isActive={active} size="sm">
                            <Link href={item.url} onClick={() => setOpenMobile(false)}>
                              <item.icon className="h-3.5 w-3.5" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {standaloneItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} onClick={() => setOpenMobile(false)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto border-t pt-2">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Operasyon
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} onClick={() => setOpenMobile(false)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{username}</div>
            <div className="text-[11px] text-muted-foreground">Süper Admin</div>
          </div>
          <SidebarMenuButton
            type="button"
            className="w-auto"
            onClick={async () => {
              await apiRequest("POST", "/api/auth/logout");
              window.location.reload();
            }}
            aria-label="Çıkış yap"
          >
            <LogOut className="h-4 w-4" />
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
